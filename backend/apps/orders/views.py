from django.contrib.auth import get_user_model
from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status as http_status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import HasModulePermission
from apps.core.periods import period_start_date

from .history import record_event, record_status_change
from .models import OrderAttachment, OrderEvent, WorkOrder
from .notifications import (
    maybe_notify_created,
    maybe_notify_status_change,
    notify_status,
)
from .pdf import render_order_pdf
from .serializers import (
    OrderAttachmentSerializer,
    OrderEventSerializer,
    OrderStatusHistorySerializer,
    TechnicianSerializer,
    WorkOrderSerializer,
)
from .status_groups import OPERATIONAL_STATUSES
from .status_transitions import can_transition
from .stock import deduct_stock_for_order

User = get_user_model()

# Limite de tamanho de anexo (10 MB) e tipos aceitos (imagens + PDF).
MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
ALLOWED_ATTACHMENT_PREFIXES = ("image/",)
ALLOWED_ATTACHMENT_TYPES = ("application/pdf",)


class WorkOrderViewSet(viewsets.ModelViewSet):
    serializer_class = WorkOrderSerializer
    permission_classes = [HasModulePermission]
    permission_module = "orders"
    # Arrastar/mudar status e anexar/remover arquivos são edições da OS; ver o
    # histórico, listar técnicos e listar anexos exigem só ver a OS.
    permission_action_map = {
        "move": "edit",
        "status_history": "view",
        "events": "view",
        "technicians": "view",
        "attachments": "view",
        "attachment": "edit",
        "notify_customer": "edit",
        "pdf": "view",
    }

    def get_queryset(self):
        queryset = WorkOrder.objects.select_related(
            "customer", "vehicle", "assigned_technician"
        ).prefetch_related(
            "service_items__service",
            "package_items__package",
            "part_items__part",
            "payments",
        )

        customer_id = self.request.query_params.get("customer")
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)

        vehicle_id = self.request.query_params.get("vehicle")
        if vehicle_id:
            queryset = queryset.filter(vehicle_id=vehicle_id)

        technician_id = self.request.query_params.get("technician")
        if technician_id:
            queryset = queryset.filter(assigned_technician_id=technician_id)

        # Detail routes must resolve an OS regardless of soft-delete/status,
        # same reasoning as the other modules' get_queryset.
        if self.action != "list":
            return queryset

        # Soft-delete dimension (separate from the workflow `status` field).
        active_param = self.request.query_params.get("active", "active")
        if active_param == "active":
            queryset = queryset.filter(is_active=True)
        elif active_param == "inactive":
            queryset = queryset.filter(is_active=False)

        # Operational board (Dashboard aba OS): only OS still in the shop flow,
        # never finished/canceled.
        if self.request.query_params.get("board") == "operational":
            queryset = queryset.filter(status__in=OPERATIONAL_STATUSES)

        # Period filter over the opening date (Hoje/Esta semana/Este mês/30 dias).
        start = period_start_date(self.request.query_params.get("period"))
        if start is not None:
            queryset = queryset.filter(opened_at__gte=start)

        # Workflow status filter (Aberta, Em execução, ...). Accepts a single
        # status or a comma-separated list (used by the Kanban to fetch only the
        # visible columns in one request).
        status_param = self.request.query_params.get("status")
        if status_param:
            statuses = [s for s in status_param.split(",") if s]
            queryset = queryset.filter(status__in=statuses)

        # Overdue filter (OS atrasadas): expected delivery in the past and still
        # in the shop flow (never finished/canceled).
        if self.request.query_params.get("overdue") in ("true", "1"):
            queryset = queryset.filter(
                expected_delivery__lt=timezone.localdate()
            ).exclude(status__in=[WorkOrder.Status.FINISHED, WorkOrder.Status.CANCELED])

        search = self.request.query_params.get("search", "").strip()
        if search:
            filters = (
                Q(vehicle__license_plate__icontains=search)
                | Q(customer__name__icontains=search)
                | Q(vehicle__brand__icontains=search)
                | Q(vehicle__model__icontains=search)
            )
            digits = "".join(c for c in search if c.isdigit())
            if digits:
                filters |= Q(customer__whatsapp__icontains=digits) | Q(
                    customer__phone__icontains=digits
                )
            if search.isdigit():
                filters |= Q(number=int(search))
            queryset = queryset.filter(filters)

        return queryset

    def perform_create(self, serializer):
        order = serializer.save()
        # Primeira entrada da linha do tempo (from vazio = criação).
        record_status_change(order, "", order.status, self.request.user)
        record_event(
            order,
            OrderEvent.Type.CREATED,
            "OS criada",
            actor=self.request.user,
        )
        # E-mail de abertura ao cliente (se configurado).
        maybe_notify_created(order, actor=self.request.user)

    def perform_update(self, serializer):
        # Captura o status antes de salvar para detectar a transição para
        # "Finalizada" (status também pode mudar por PATCH no editor da OS, não
        # só pelo arrastar no Kanban -- ver `move`).
        old_status = serializer.instance.status
        order = serializer.save()
        self._on_status_change(order, old_status)

    def _on_status_change(self, order, old_status):
        """Histórico, baixa de estoque e notificação ao cliente quando o status muda."""
        if order.status != old_status:
            labels = dict(WorkOrder.Status.choices)
            record_status_change(order, old_status, order.status, self.request.user)
            record_event(
                order,
                OrderEvent.Type.STATUS_CHANGED,
                f"{labels.get(old_status, old_status)} → "
                f"{labels.get(order.status, order.status)}",
                actor=self.request.user,
            )
            # E-mail automático ao cliente nos marcos (pronta/finalizada).
            maybe_notify_status_change(order, actor=self.request.user)
        self._maybe_deduct_stock(order, old_status)

    def _maybe_deduct_stock(self, order, old_status):
        """Dá baixa das peças ao entrar em 'Finalizada' (idempotente)."""
        if (
            order.status == WorkOrder.Status.FINISHED
            and old_status != WorkOrder.Status.FINISHED
        ):
            deduct_stock_for_order(order, self.request.user)

    def destroy(self, request, *args, **kwargs):
        order = self.get_object()
        order.is_active = False
        order.save(update_fields=["is_active", "updated_at"])
        return Response(status=http_status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def reactivate(self, request, pk=None):
        order = self.get_object()
        order.is_active = True
        order.save(update_fields=["is_active", "updated_at"])
        return Response(WorkOrderSerializer(order).data)

    @action(detail=True, methods=["post"])
    def move(self, request, pk=None):
        """Muda o status da OS respeitando o fluxo do Kanban.

        Chamada quando um card é arrastado para outra coluna. O backend valida a
        transição (fonte da verdade); transições inválidas retornam 400 com
        mensagem clara e o frontend faz rollback do card para a coluna anterior.
        """
        order = self.get_object()
        new_status = request.data.get("status")
        labels = dict(WorkOrder.Status.choices)
        if new_status not in labels:
            return Response(
                {"status": ["Status inválido."]},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        if not can_transition(order.status, new_status):
            return Response(
                {
                    "status": [
                        f"Não é possível mover de '{order.get_status_display()}' "
                        f"para '{labels[new_status]}'."
                    ]
                },
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        if new_status != order.status:
            old_status = order.status
            order.status = new_status
            order.save(update_fields=["status", "updated_at"])
            self._on_status_change(order, old_status)
        serializer = WorkOrderSerializer(order, context=self.get_serializer_context())
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        """Gera o PDF da OS (inline)."""
        order = self.get_object()
        pdf_bytes = render_order_pdf(order, request=request)
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = (
            f'inline; filename="os-{order.number:04d}.pdf"'
        )
        return response

    @action(detail=True, methods=["post"], url_path="notify-customer")
    def notify_customer(self, request, pk=None):
        """Envia manualmente um e-mail ao cliente com o status atual da OS."""
        order = self.get_object()
        to_email = notify_status(order, actor=request.user, channel="E-mail (manual)")
        if to_email is None:
            return Response(
                {"detail": "O cliente não tem e-mail cadastrado."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        return Response({"sent": True, "email": to_email})

    @action(detail=True, methods=["get"], url_path="status-history")
    def status_history(self, request, pk=None):
        """Linha do tempo das mudanças de status da OS (mais recente primeiro)."""
        order = self.get_object()
        history = order.status_history.select_related("changed_by").all()
        return Response(OrderStatusHistorySerializer(history, many=True).data)

    @action(detail=True, methods=["get"])
    def events(self, request, pk=None):
        """Linha do tempo unificada da OS: status, fotos e ciclo do orçamento."""
        order = self.get_object()
        items = order.events.select_related("actor").all()
        event_type = request.query_params.get("type")
        if event_type:
            items = items.filter(event_type=event_type)
        return Response(OrderEventSerializer(items, many=True).data)

    @action(detail=False, methods=["get"])
    def technicians(self, request):
        """Técnicos ativos, para o seletor de técnico responsável da OS."""
        techs = User.objects.filter(is_active=True, role__key="tecnico")
        return Response(TechnicianSerializer(techs, many=True).data)

    @action(detail=True, methods=["get", "post"])
    def attachments(self, request, pk=None):
        """Lista (GET) e envia (POST, multipart) anexos da OS."""
        order = self.get_object()

        if request.method == "GET":
            items = order.attachments.select_related("uploaded_by").all()
            return Response(OrderAttachmentSerializer(items, many=True).data)

        # POST exige orders.edit (anexar é uma edição da OS).
        if not request.user.has_perm_code("orders.edit"):
            return Response(
                {"detail": "Você não tem permissão para anexar arquivos."},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        upload = request.FILES.get("file")
        if upload is None:
            return Response(
                {"file": ["Envie um arquivo."]},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        if upload.size > MAX_ATTACHMENT_BYTES:
            return Response(
                {"file": ["O arquivo excede o limite de 10 MB."]},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        content_type = upload.content_type or ""
        allowed = (
            content_type.startswith(ALLOWED_ATTACHMENT_PREFIXES)
            or content_type in ALLOWED_ATTACHMENT_TYPES
        )
        if not allowed:
            return Response(
                {"file": ["Tipo de arquivo não permitido. Envie uma imagem ou PDF."]},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        category = request.data.get("category") or OrderAttachment.Category.OTHER
        if category not in OrderAttachment.Category.values:
            category = OrderAttachment.Category.OTHER

        attachment = OrderAttachment.objects.create(
            order=order,
            file=upload,
            original_name=upload.name[:255],
            content_type=content_type[:100],
            size=upload.size,
            category=category,
            caption=(request.data.get("caption") or "")[:255],
            uploaded_by=request.user,
        )
        record_event(
            order,
            OrderEvent.Type.ATTACHMENT_ADDED,
            attachment.original_name,
            actor=request.user,
        )
        return Response(
            OrderAttachmentSerializer(attachment).data,
            status=http_status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["patch", "delete"],
        url_path="attachments/(?P<attachment_id>[^/.]+)",
    )
    def attachment(self, request, pk=None, attachment_id=None):
        """Edita (PATCH: categoria/legenda) ou remove (DELETE) um anexo da OS.

        Exige orders.edit (ver o permission_action_map).
        """
        order = self.get_object()
        try:
            item = order.attachments.get(pk=attachment_id)
        except OrderAttachment.DoesNotExist:
            return Response(status=http_status.HTTP_404_NOT_FOUND)

        if request.method == "PATCH":
            serializer = OrderAttachmentSerializer(
                item, data=request.data, partial=True
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)

        name = item.original_name
        item.file.delete(save=False)
        item.delete()
        record_event(
            order,
            OrderEvent.Type.ATTACHMENT_REMOVED,
            name,
            actor=request.user,
        )
        return Response(status=http_status.HTTP_204_NO_CONTENT)
