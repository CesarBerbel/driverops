from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.accounts.audit import record_audit
from apps.accounts.permissions import HasModulePermission

from .events import EVENTS
from .models import NotificationTemplate
from .rendering import render, validate_template_fields
from .serializers import NotificationTemplateSerializer
from .services import render_notification, send_notification
from .variables import build_context, sample_context, variable_catalog

# Campos de conteúdo cujas alterações interessam à auditoria.
_AUDITED_FIELDS = [
    "name",
    "description",
    "subject",
    "html_content",
    "text_content",
    "is_active",
]


class NotificationTemplateViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Gestão dos templates de notificação ao cliente.

    Catálogo fixo (sem create/destroy): lista/edita/testa/restaura/ativa. Todas
    as ações de escrita são auditadas e exigem a permissão ``notifications.*``.
    """

    serializer_class = NotificationTemplateSerializer
    permission_classes = [HasModulePermission]
    permission_module = "notifications"
    permission_action_map = {
        "preview": "view",
        "metadata": "view",
        "restore": "edit",
        "test_send": "test",
        "bulk_status": "edit",
    }

    def get_queryset(self):
        queryset = NotificationTemplate.objects.select_related("updated_by")
        params = self.request.query_params
        channel = params.get("channel")
        event = params.get("event")
        status_filter = params.get("status")
        search = params.get("q") or params.get("search")
        if channel:
            queryset = queryset.filter(channel=channel)
        if event:
            queryset = queryset.filter(event=event)
        if status_filter == "active":
            queryset = queryset.filter(is_active=True)
        elif status_filter == "inactive":
            queryset = queryset.filter(is_active=False)
        if search:
            from django.db.models import Q

            queryset = queryset.filter(
                Q(name__icontains=search) | Q(description__icontains=search)
            )
        return queryset

    # --- edição (auditada) ---

    def perform_update(self, serializer):
        instance = serializer.instance
        before = {f: getattr(instance, f) for f in _AUDITED_FIELDS}
        template = serializer.save(updated_by=self.request.user, is_customized=True)
        after = {f: getattr(template, f) for f in _AUDITED_FIELDS}
        changed = {
            f: {"from": before[f], "to": after[f]}
            for f in _AUDITED_FIELDS
            if before[f] != after[f]
        }
        record_audit(
            self.request,
            "notification.template.update",
            old_value={
                "template_id": template.id,
                "event": template.event,
                "channel": template.channel,
            },
            new_value={"template_id": template.id, "changed": changed},
        )

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        """Restaura o template a partir do padrão de fábrica do sistema."""
        template = self.get_object()
        before = {f: getattr(template, f) for f in _AUDITED_FIELDS}
        template.apply_default()
        template.is_active = True
        template.updated_by = request.user
        template.save()
        record_audit(
            request,
            "notification.template.restore",
            old_value={
                "template_id": template.id,
                **before,
                "html_content": bool(before["html_content"]),
            },
            new_value={
                "template_id": template.id,
                "event": template.event,
                "channel": template.channel,
            },
        )
        return Response(self.get_serializer(template).data)

    # --- pré-visualização ---

    def _context_from_request(self, request):
        """Monta o contexto de renderização respeitando as permissões de leitura.

        ``sample`` (padrão) usa dados simulados. ``order``/``quote`` usam um
        registro real -- exige a permissão de visualização correspondente.
        """
        kind = request.data.get("context", "sample")
        if kind == "order":
            order_id = request.data.get("work_order")
            if not request.user.has_perm_code("orders.view"):
                raise PermissionDenied("Sem permissão para visualizar OS.")
            from apps.orders.models import WorkOrder

            order = WorkOrder.objects.filter(pk=order_id).first()
            if order is None:
                raise ValidationError({"work_order": "OS não encontrada."})
            return build_context(work_order=order)
        if kind == "quote":
            quote_id = request.data.get("quote")
            if not request.user.has_perm_code("quotes.view"):
                raise PermissionDenied("Sem permissão para visualizar orçamentos.")
            from apps.quotes.models import Quote

            quote = Quote.objects.filter(pk=quote_id).first()
            if quote is None:
                raise ValidationError({"quote": "Orçamento não encontrado."})
            return build_context(quote=quote)
        return sample_context()

    @action(detail=True, methods=["post"])
    def preview(self, request, pk=None):
        """Renderiza o template com dados simulados ou um contexto real."""
        template = self.get_object()
        context = self._context_from_request(request)
        errors = validate_template_fields(
            channel=template.channel,
            name=template.name,
            subject=template.subject,
            html_content=template.html_content,
            text_content=template.text_content,
        )
        return Response(
            {
                "subject": render(template.subject, context),
                "html": render(template.html_content, context, escape=True),
                "text": render(template.text_content, context),
                "errors": errors,
            }
        )

    @action(detail=True, methods=["post"], url_path="test-send")
    def test_send(self, request, pk=None):
        """Envia uma mensagem de teste ao e-mail/telefone informado."""
        template = self.get_object()
        to = (request.data.get("to") or "").strip()
        if not to:
            raise ValidationError({"to": "Informe um destinatário para o teste."})

        kind = request.data.get("context", "sample")
        work_order = None
        quote = None
        if kind == "order":
            if not request.user.has_perm_code("orders.view"):
                raise PermissionDenied("Sem permissão para visualizar OS.")
            from apps.orders.models import WorkOrder

            work_order = WorkOrder.objects.filter(
                pk=request.data.get("work_order")
            ).first()
        elif kind == "quote":
            if not request.user.has_perm_code("quotes.view"):
                raise PermissionDenied("Sem permissão para visualizar orçamentos.")
            from apps.quotes.models import Quote

            quote = Quote.objects.filter(pk=request.data.get("quote")).first()

        if kind == "sample":
            # Sem objeto real: renderiza com amostra e envia por e-mail simulando.
            result = self._send_sample_test(template, to)
        else:
            result = send_notification(
                template.event,
                channel=template.channel,
                work_order=work_order,
                quote=quote,
                actor=request.user,
                to=to,
                is_test=True,
            )
        record_audit(
            request,
            "notification.template.test",
            new_value={
                "template_id": template.id,
                "channel": template.channel,
                "to": to,
                "status": result.status,
            },
        )
        return Response(
            {
                "status": result.status,
                "recipient": result.recipient,
                "error": result.error,
                "link": result.link,
                "errors": result.errors,
            }
        )

    def _send_sample_test(self, template, to):
        from django.conf import settings
        from django.core.mail import send_mail

        from .models import NotificationLog

        context = sample_context()
        rendered = render_notification(template.event, template.channel, context)
        rendered.recipient = to
        if rendered.errors:
            self._log_sample(rendered, to)
            return rendered
        try:
            if template.channel == "email":
                send_mail(
                    subject=rendered.subject,
                    message=rendered.text,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[to],
                    html_message=rendered.html or None,
                )
                rendered.status = NotificationLog.Status.SENT
            elif template.channel == "whatsapp":
                from .services import _whatsapp_link

                rendered.link = _whatsapp_link(to, rendered.text)
                rendered.status = NotificationLog.Status.SENT
            else:
                rendered.status = NotificationLog.Status.SENT
        except Exception as exc:  # noqa: BLE001
            rendered.status = NotificationLog.Status.FAILED
            rendered.error = str(exc)
        self._log_sample(rendered, to)
        return rendered

    def _log_sample(self, rendered, to):
        from .models import NotificationLog

        NotificationLog.objects.create(
            event=rendered.event,
            channel=rendered.channel,
            template=rendered.template,
            recipient=to[:200],
            subject=rendered.subject[:200],
            status=rendered.status,
            error=rendered.error,
            is_test=True,
            created_by=self.request.user,
        )

    # --- histórico de alterações ---

    @action(detail=True, methods=["get"])
    def history(self, request, pk=None):
        """Histórico básico de alterações do template (via trilha de auditoria)."""
        from apps.accounts.models import AuditLog

        template = self.get_object()
        logs = AuditLog.objects.filter(
            action__startswith="notification.template"
        ).select_related("actor")[:100]
        rows = []
        for log in logs:
            payload = log.new_value or {}
            if payload.get("template_id") != template.id:
                continue
            rows.append(
                {
                    "action": log.action,
                    "actor": (
                        (log.actor.full_name or log.actor.email)
                        if log.actor_id
                        else None
                    ),
                    "changed": list((payload.get("changed") or {}).keys()),
                    "created_at": log.created_at,
                }
            )
        return Response(rows[:30])

    # --- ativação/inativação em massa ---

    @action(detail=False, methods=["post"], url_path="bulk-status")
    def bulk_status(self, request):
        """Ativa ou inativa em massa os templates informados."""
        ids = request.data.get("ids")
        is_active = request.data.get("is_active")
        if not isinstance(ids, list) or not ids:
            raise ValidationError({"ids": "Selecione ao menos um template."})
        if not isinstance(is_active, bool):
            raise ValidationError({"is_active": "Informe o novo status (true/false)."})

        templates = list(NotificationTemplate.objects.filter(id__in=ids))
        updated = []
        for template in templates:
            if template.is_active != is_active:
                template.is_active = is_active
                template.updated_by = request.user
                template.save(update_fields=["is_active", "updated_by", "updated_at"])
                updated.append(template.id)

        if updated:
            record_audit(
                request,
                "notification.template.bulk_status",
                new_value={
                    "ids": [t.id for t in templates],
                    "is_active": is_active,
                    "updated": updated,
                },
            )
        return Response({"updated": len(updated), "is_active": is_active})

    # --- metadados (catálogo de variáveis, eventos, canais) ---

    @action(detail=False, methods=["get"])
    def metadata(self, request):
        return Response(
            {
                "events": [
                    {"key": key, "label": label, "description": desc, "context": ctx}
                    for key, label, desc, ctx in EVENTS
                ],
                "channels": [
                    {"key": key, "label": label}
                    for key, label in NotificationTemplate.Channel.choices
                ],
                "variables": variable_catalog(),
            }
        )
