import base64
from io import BytesIO

from django.db import transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status as http_status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import HasModulePermission
from apps.core.uploads import sanitized_upload
from apps.orders.history import record_event
from apps.orders.models import OrderEvent, WorkOrder

from .emails import send_quote_approval_email
from .models import Quote
from .pdf import render_quote_pdf
from .serializers import PublicQuoteSerializer, QuoteSerializer
from .services import (
    advance_order_after_approval,
    apply_item_decisions,
    create_quote_from_order,
)

# Limites de upload do orçamento.
MAX_SIGNED_DOCUMENT_BYTES = 10 * 1024 * 1024  # 10 MB (via assinada: imagem/PDF)
MAX_SIGNATURE_BYTES = 2 * 1024 * 1024  # 2 MB (assinatura desenhada, PNG)


def _client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


_QUOTE_DECISION_EVENTS = {
    Quote.Status.APPROVED: OrderEvent.Type.QUOTE_APPROVED,
    Quote.Status.PARTIALLY_APPROVED: OrderEvent.Type.QUOTE_PARTIALLY_APPROVED,
    Quote.Status.REJECTED: OrderEvent.Type.QUOTE_REJECTED,
}


def _record_quote_decision(quote, channel, actor=None):
    """Registra na timeline da OS a decisão do orçamento (aprovado/parcial/recusado)."""
    event_type = _QUOTE_DECISION_EVENTS.get(quote.status)
    if event_type:
        record_event(
            quote.work_order,
            event_type,
            f"Orçamento #{quote.number}",
            actor=actor,
            channel=channel,
        )


def _decode_signature(data_uri, name):
    """data:image/png;base64,... -> ContentFile. Retorna None se inválido.

    Valida o conteúdo real (imagem) e o tamanho -- não confia no data URI -- e
    RE-CODIFICA a imagem, descartando qualquer conteúdo embutido.
    """
    if not data_uri:
        return None
    payload = data_uri.split(";base64,", 1)[-1]
    try:
        raw = base64.b64decode(payload)
    except (ValueError, TypeError):
        return None
    if not raw or len(raw) > MAX_SIGNATURE_BYTES:
        return None
    buffer = BytesIO(raw)
    buffer.name = name or "assinatura"
    try:
        return sanitized_upload(
            buffer,
            max_bytes=MAX_SIGNATURE_BYTES,
            allow_pdf=False,
            field="signature",
            fallback="assinatura",
        )
    except ValidationError:
        return None


class QuoteViewSet(viewsets.ModelViewSet):
    """CRUD e ações do orçamento para as telas internas (autenticadas)."""

    serializer_class = QuoteSerializer
    http_method_names = ["get", "post", "delete"]
    permission_classes = [HasModulePermission]
    permission_module = "quotes"
    permission_action_map = {
        "cancel": "cancel",
        "send": "send",
        "approve_physical": "approve",
        "approve_tablet": "approve",
        "reject": "reject",
        "pdf": "pdf",
        # Enviar a via assinada é registrar a aprovação -> exige quotes.approve.
        "upload_signed": "approve",
        "destroy": "cancel",
    }

    def get_queryset(self):
        queryset = Quote.objects.select_related(
            "work_order__customer", "work_order__vehicle", "created_by", "approved_by"
        ).prefetch_related("items")
        work_order_id = self.request.query_params.get("work_order")
        if work_order_id:
            queryset = queryset.filter(work_order_id=work_order_id)
        if self.action == "list":
            queryset = queryset.filter(is_active=True)
        return queryset

    def create(self, request, *args, **kwargs):
        work_order_id = request.data.get("work_order")
        with transaction.atomic():
            order = get_object_or_404(
                WorkOrder.objects.select_for_update(), pk=work_order_id
            )
            # Não permite mais de um orçamento em aberto por OS. O lock da OS
            # serializa requisições concorrentes para a mesma ordem e fecha a
            # janela de corrida entre checar orçamento aberto e criar o novo.
            open_quote = (
                order.quotes.filter(is_active=True, status__in=Quote.OPEN_STATUSES)
                .order_by("-number")
                .first()
            )
            if open_quote:
                return Response(
                    {
                        "detail": (
                            f"Já existe um orçamento em aberto (#{open_quote.number}, "
                            f"{open_quote.get_status_display().lower()}) para esta OS. "
                            "Aprove, recuse ou cancele o orçamento atual antes "
                            "de criar outro."
                        )
                    },
                    status=http_status.HTTP_409_CONFLICT,
                )
            quote = create_quote_from_order(
                order,
                user=request.user,
                valid_until=request.data.get("valid_until") or None,
            )
            record_event(
                order,
                OrderEvent.Type.QUOTE_CREATED,
                f"Orçamento #{quote.number}",
                actor=request.user,
            )
        serializer = self.get_serializer(quote)
        return Response(serializer.data, status=http_status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        # Nunca apaga fisicamente -- soft delete (mantém histórico/versões).
        quote = self.get_object()
        quote.is_active = False
        quote.save(update_fields=["is_active", "updated_at"])
        return Response(status=http_status.HTTP_204_NO_CONTENT)

    def _reject_if_terminal(self, quote):
        if quote.is_terminal:
            return Response(
                {"detail": f"Orçamento já {quote.get_status_display().lower()}."},
                status=http_status.HTTP_409_CONFLICT,
            )
        return None

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        quote = self.get_object()
        blocked = self._reject_if_terminal(quote)
        if blocked:
            return blocked
        quote.status = Quote.Status.CANCELED
        quote.decided_at = timezone.now()
        quote.save(update_fields=["status", "decided_at", "updated_at"])
        return Response(self.get_serializer(quote).data)

    @action(detail=True, methods=["post"])
    def send(self, request, pk=None):
        quote = self.get_object()
        blocked = self._reject_if_terminal(quote)
        if blocked:
            return blocked
        email = (request.data.get("email") or quote.work_order.customer.email).strip()
        if not email:
            return Response(
                {"email": ["Informe um e-mail para enviar o orçamento."]},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        quote.status = Quote.Status.SENT
        quote.sent_at = timezone.now()
        quote.sent_by = request.user
        quote.sent_to_email = email
        quote.save(
            update_fields=[
                "status",
                "sent_at",
                "sent_by",
                "sent_to_email",
                "updated_at",
            ]
        )
        send_quote_approval_email(quote, email, actor=request.user)
        record_event(
            quote.work_order,
            OrderEvent.Type.QUOTE_SENT,
            f"Orçamento #{quote.number} para {email}",
            actor=request.user,
            channel="Link por e-mail",
        )
        return Response(self.get_serializer(quote).data)

    @action(detail=True, methods=["post"], url_path="approve-physical")
    def approve_physical(self, request, pk=None):
        quote = self.get_object()
        blocked = self._reject_if_terminal(quote)
        if blocked:
            return blocked
        # approved_item_ids ausente => aprovação integral (compatível).
        result = apply_item_decisions(
            quote, request.data.get("approved_item_ids"), request=request
        )
        quote.status = result
        quote.approval_channel = Quote.Channel.PHYSICAL
        quote.approved_by = request.user
        quote.decided_at = timezone.now()
        quote.client_name = (
            request.data.get("client_name") or quote.work_order.customer.name
        )
        quote.approval_note = request.data.get("note", "")
        quote.terms_accepted = True
        quote.save()
        if result != Quote.Status.REJECTED:
            advance_order_after_approval(
                quote.work_order, actor=getattr(request, "user", None)
            )
        _record_quote_decision(quote, "Presencial", actor=request.user)
        return Response(self.get_serializer(quote).data)

    @action(detail=True, methods=["post"], url_path="approve-tablet")
    def approve_tablet(self, request, pk=None):
        quote = self.get_object()
        blocked = self._reject_if_terminal(quote)
        if blocked:
            return blocked
        client_name = (request.data.get("client_name") or "").strip()
        signature = _decode_signature(
            request.data.get("signature"), f"quote-{quote.number}-signature.png"
        )
        if not client_name:
            return Response(
                {"client_name": ["Informe o nome do cliente."]},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        if signature is None:
            return Response(
                {"signature": ["A assinatura é obrigatória para aprovar no tablet."]},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        result = apply_item_decisions(
            quote, request.data.get("approved_item_ids"), request=request
        )
        quote.signature_image = signature
        quote.status = result
        quote.approval_channel = Quote.Channel.TABLET
        quote.approved_by = request.user
        quote.decided_at = timezone.now()
        quote.client_name = client_name
        quote.terms_accepted = True
        quote.save()
        if result != Quote.Status.REJECTED:
            advance_order_after_approval(
                quote.work_order, actor=getattr(request, "user", None)
            )
        _record_quote_decision(quote, "Assinatura no tablet", actor=request.user)
        return Response(self.get_serializer(quote).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        quote = self.get_object()
        blocked = self._reject_if_terminal(quote)
        if blocked:
            return blocked
        apply_item_decisions(quote, [])  # recusa todos os itens
        quote.status = Quote.Status.REJECTED
        quote.decided_at = timezone.now()
        quote.rejection_reason = request.data.get("reason", "")
        quote.save(
            update_fields=["status", "decided_at", "rejection_reason", "updated_at"]
        )
        _record_quote_decision(quote, "Presencial", actor=request.user)
        return Response(self.get_serializer(quote).data)

    @action(
        detail=True,
        methods=["post"],
        url_path="upload-signed",
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload_signed(self, request, pk=None):
        quote = self.get_object()
        document = request.FILES.get("document")
        # Valida (magic bytes), RE-CODIFICA imagens e força nome/extensão do
        # conteúdo (imagem ou PDF). 400 amigável se inválido.
        document = sanitized_upload(
            document,
            max_bytes=MAX_SIGNED_DOCUMENT_BYTES,
            field="document",
            fallback="assinado",
        )
        # Remove a via anterior para não deixar arquivo órfão.
        if quote.signed_document:
            quote.signed_document.delete(save=False)
        quote.signed_document = document
        quote.save(update_fields=["signed_document", "updated_at"])
        return Response(self.get_serializer(quote).data)

    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        quote = self.get_object()
        pdf_bytes = render_quote_pdf(quote, request=request)
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = (
            f'inline; filename="orcamento-{quote.number:04d}.pdf"'
        )
        return response


# --------------------------------------------------------------------------
# Página pública de aprovação (sem autenticação, acesso apenas pelo token)
# --------------------------------------------------------------------------


class _PublicQuoteBase(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get_quote(self, token):
        quote = get_object_or_404(Quote, public_token=token, is_active=True)
        self._expire_if_needed(quote)
        return quote

    def _expire_if_needed(self, quote):
        if (
            quote.valid_until
            and quote.status in Quote.DECIDABLE_STATUSES
            and quote.valid_until < timezone.localdate()
        ):
            quote.status = Quote.Status.EXPIRED
            quote.save(update_fields=["status", "updated_at"])


class PublicQuoteDetailView(_PublicQuoteBase):
    def get(self, request, token):
        quote = self.get_quote(token)
        # Marca como visualizado na primeira abertura pelo cliente.
        if quote.status == Quote.Status.SENT:
            quote.status = Quote.Status.VIEWED
            quote.viewed_at = timezone.now()
            quote.save(update_fields=["status", "viewed_at", "updated_at"])
        return Response(PublicQuoteSerializer(quote, context={"request": request}).data)


class PublicQuoteApproveView(_PublicQuoteBase):
    def post(self, request, token):
        quote = self.get_quote(token)
        if quote.status not in Quote.DECIDABLE_STATUSES:
            return Response(
                {
                    "detail": f"Este orçamento já está {quote.get_status_display().lower()}."
                },
                status=http_status.HTTP_409_CONFLICT,
            )
        if not request.data.get("terms_accepted"):
            return Response(
                {"terms_accepted": ["É necessário aceitar os termos para aprovar."]},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        client_name = (request.data.get("client_name") or "").strip()
        if not client_name:
            return Response(
                {"client_name": ["Informe seu nome para aprovar."]},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        # Aprovação parcial: approved_item_ids ausente => aprova todos.
        result = apply_item_decisions(
            quote, request.data.get("approved_item_ids"), request=request
        )
        quote.status = result
        quote.approval_channel = Quote.Channel.EMAIL_LINK
        quote.decided_at = timezone.now()
        quote.client_name = client_name
        quote.terms_accepted = True
        quote.decision_ip = _client_ip(request)
        quote.decision_user_agent = request.META.get("HTTP_USER_AGENT", "")[:500]
        quote.save()
        if result != Quote.Status.REJECTED:
            advance_order_after_approval(
                quote.work_order, actor=getattr(request, "user", None)
            )
        _record_quote_decision(quote, "Link por e-mail")
        return Response(PublicQuoteSerializer(quote, context={"request": request}).data)


class PublicQuoteRejectView(_PublicQuoteBase):
    def post(self, request, token):
        quote = self.get_quote(token)
        if quote.status not in Quote.DECIDABLE_STATUSES:
            return Response(
                {
                    "detail": f"Este orçamento já está {quote.get_status_display().lower()}."
                },
                status=http_status.HTTP_409_CONFLICT,
            )
        apply_item_decisions(quote, [])  # recusa todos os itens
        quote.status = Quote.Status.REJECTED
        quote.approval_channel = Quote.Channel.EMAIL_LINK
        quote.decided_at = timezone.now()
        quote.rejection_reason = request.data.get("reason", "")
        quote.client_name = (request.data.get("client_name") or "").strip()
        quote.decision_ip = _client_ip(request)
        quote.decision_user_agent = request.META.get("HTTP_USER_AGENT", "")[:500]
        quote.save()
        _record_quote_decision(quote, "Link por e-mail")
        return Response(PublicQuoteSerializer(quote, context={"request": request}).data)
