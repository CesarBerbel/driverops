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
from apps.core.uploads import sanitize_filename, validate_upload

from . import state_machine
from .history import record_event, record_status_change
from .models import OrderAttachment, OrderEvent, WorkOrder
from .notifications import maybe_notify_created, notify_status
from .pdf import render_order_pdf
from .serializers import (
    OrderAttachmentSerializer,
    OrderEventSerializer,
    OrderStatusHistorySerializer,
    TechnicianSerializer,
    WorkOrderSerializer,
)
from .state_machine import TransitionError
from .status_groups import OPERATIONAL_STATUSES

User = get_user_model()

# Limite de tamanho de anexo (10 MB). Tipo validado por magic bytes (imagem/PDF).
MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024


class WorkOrderViewSet(viewsets.ModelViewSet):
    serializer_class = WorkOrderSerializer
    permission_classes = [HasModulePermission]
    permission_module = "orders"
    # Arrastar/mudar status exige visualizar a OS; a permissão operacional
    # específica (kanban.move) e as permissões críticas (orders.cancel/finish)
    # são validadas dentro da action.
    permission_action_map = {
        # Mudar status exige ver a OS; a permissão específica de cada transição
        # (kanban.move / orders.finish / orders.cancel / orders.reopen ...) é
        # validada dentro da máquina de estados.
        "move": "view",
        "transitions": "view",
        "transition": "view",
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
        # O status é read-only no update (só muda pela máquina de estados). O
        # save aqui nunca altera status; mantido simples e sem efeitos de status.
        serializer.save()

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

    def _serialized(self, order):
        return WorkOrderSerializer(order, context=self.get_serializer_context()).data

    @action(detail=True, methods=["post"])
    def move(self, request, pk=None):
        """Muda o status da OS pelo Kanban (arrastar card).

        Compatibilidade: recebe o status de destino e resolve a ação de negócio
        correspondente, delegando à máquina de estados (fonte da verdade). Aceita
        ``reason``/``notes`` para transições que exigem justificativa.
        """
        order = self.get_object()
        new_status = request.data.get("status")
        labels = dict(WorkOrder.Status.choices)
        if new_status not in labels:
            return Response(
                {"status": ["Status inválido."]},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        if new_status == order.status:
            return Response(self._serialized(order))  # no-op de reordenação
        action_key = state_machine.resolve_action(order.status, new_status)
        if action_key is None:
            return Response(
                {
                    "status": [
                        f"Não é possível mover de '{order.get_status_display()}' "
                        f"para '{labels[new_status]}'."
                    ]
                },
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        return self._do_transition(
            order,
            action_key,
            reason=request.data.get("reason", ""),
            notes=request.data.get("notes", ""),
        )

    @action(detail=True, methods=["get"])
    def transitions(self, request, pk=None):
        """Ações de status disponíveis para o usuário a partir do status atual."""
        order = self.get_object()
        return Response(
            {
                "status": order.status,
                "status_display": order.get_status_display(),
                "transitions": state_machine.get_available_transitions(
                    order, request.user
                ),
            }
        )

    @action(detail=True, methods=["post"])
    def transition(self, request, pk=None):
        """Executa uma ação de transição de status da OS (fonte da verdade)."""
        order = self.get_object()
        action_key = request.data.get("action")
        if not action_key:
            return Response(
                {"detail": "Informe a ação de transição."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        return self._do_transition(
            order,
            action_key,
            reason=request.data.get("reason", ""),
            notes=request.data.get("notes", ""),
            target_status=request.data.get("target_status"),
        )

    def _do_transition(
        self, order, action_key, *, reason="", notes="", target_status=None
    ):
        try:
            updated = state_machine.transition(
                order.id,
                action_key,
                self.request.user,
                reason=reason,
                notes=notes,
                target_status=target_status,
                request=self.request,
            )
        except TransitionError as exc:
            return Response({"detail": exc.message}, status=exc.http_status)
        return Response(self._serialized(updated))

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
        # Valida tamanho e tipo REAL (magic bytes) -- não confia no content_type
        # declarado pelo cliente. Levanta 400 amigável se inválido.
        validate_upload(upload, max_bytes=MAX_ATTACHMENT_BYTES, field="file")
        upload.name = sanitize_filename(upload.name, fallback="anexo")

        category = request.data.get("category") or OrderAttachment.Category.OTHER
        if category not in OrderAttachment.Category.values:
            category = OrderAttachment.Category.OTHER

        attachment = OrderAttachment.objects.create(
            order=order,
            file=upload,
            original_name=upload.name[:255],
            content_type=(upload.content_type or "")[:100],
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
