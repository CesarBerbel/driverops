"""Serviço de envio de notificações ao cliente via templates.

Ponto único por onde passam os envios reais e os de teste. Resolve o template
ativo do evento/canal (ou cai no padrão de fábrica quando não há personalização
válida), renderiza as variáveis com o contexto real, despacha pelo canal e
registra o resultado em :class:`NotificationLog`.

Realidade dos canais neste projeto:
- **email**: envio real via ``send_mail`` (multipart: HTML + texto puro);
- **internal**: registrado como log/timeline (sem gateway externo);
- **whatsapp**: sem API de envio -- renderiza o texto e devolve um link
  ``wa.me`` para envio manual; não há entrega automática;
- **sms**: sem provedor -- fica preparado (renderizável/testável), sem dispatch.
"""

from dataclasses import dataclass, field

from django.conf import settings
from django.core.mail import send_mail

from apps.customers.utils import only_digits

from .defaults import default_template
from .models import NotificationLog, NotificationTemplate
from .rendering import render, validate_template_fields
from .variables import build_context


@dataclass
class RenderedNotification:
    event: str
    channel: str
    subject: str = ""
    html: str = ""
    text: str = ""
    recipient: str = ""
    link: str = ""
    status: str = NotificationLog.Status.SENT
    error: str = ""
    template: object = None
    errors: list = field(default_factory=list)

    @property
    def ok(self):
        return self.status == NotificationLog.Status.SENT


def resolve_template(event, channel):
    """Devolve (template_or_None, fields).

    Usa o template do banco quando existe **e está ativo**; senão, o padrão de
    fábrica (fallback seguro). ``fields`` sempre traz name/subject/html/text.
    """
    template = (
        NotificationTemplate.objects.filter(
            event=event, channel=channel, is_active=True
        ).first()
    )
    if template is not None:
        fields = {
            "name": template.name,
            "description": template.description,
            "subject": template.subject,
            "html_content": template.html_content,
            "text_content": template.text_content,
        }
        return template, fields
    return None, default_template(event, channel)


def render_notification(event, channel, context):
    """Renderiza um evento/canal com o contexto informado (sem enviar)."""
    template, fields = resolve_template(event, channel)
    errors = validate_template_fields(
        channel=channel,
        name=fields["name"],
        subject=fields["subject"],
        html_content=fields["html_content"],
        text_content=fields["text_content"],
    )
    result = RenderedNotification(
        event=event,
        channel=channel,
        template=template,
        subject=render(fields["subject"], context),
        html=render(fields["html_content"], context),
        text=render(fields["text_content"], context),
        errors=errors,
    )
    if errors:
        result.status = NotificationLog.Status.FAILED
        result.error = " ".join(errors)
    return result


def _whatsapp_link(phone, text):
    digits = only_digits(phone or "")
    if not digits:
        return ""
    if len(digits) <= 11:
        digits = "55" + digits
    from urllib.parse import quote

    return f"https://wa.me/{digits}?text={quote(text)}"


def _default_recipient(channel, customer, to):
    if to:
        return to
    if customer is None:
        return ""
    if channel == "email":
        return (customer.email or "").strip()
    if channel in ("whatsapp", "sms"):
        return only_digits(customer.whatsapp or customer.phone or "")
    return (customer.name or "").strip()


def send_notification(
    event,
    *,
    channel="email",
    work_order=None,
    quote=None,
    payment=None,
    actor=None,
    to=None,
    is_test=False,
):
    """Renderiza e despacha uma notificação; sempre registra um log.

    Nunca levanta exceção por template inválido ou destinatário ausente: nesses
    casos devolve um resultado com ``status`` failed/skipped e registra o log.
    """
    context = build_context(work_order=work_order, quote=quote, payment=payment)
    result = render_notification(event, channel, context)

    customer = None
    if work_order is not None:
        customer = work_order.customer
    elif quote is not None:
        customer = quote.work_order.customer
    result.recipient = _default_recipient(channel, customer, to)

    # Template inválido: impede o envio (critério de aceite).
    if result.errors:
        _log(result, work_order, quote, actor, is_test)
        return result

    if not result.recipient:
        result.status = NotificationLog.Status.SKIPPED
        result.error = "Destinatário não informado."
        _log(result, work_order, quote, actor, is_test)
        return result

    try:
        if channel == "email":
            send_mail(
                subject=result.subject,
                message=result.text,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[result.recipient],
                html_message=result.html or None,
            )
            result.status = NotificationLog.Status.SENT
        elif channel == "whatsapp":
            # Sem API de envio: preparamos o link para envio manual.
            result.link = _whatsapp_link(result.recipient, result.text)
            result.status = (
                NotificationLog.Status.SENT if is_test else NotificationLog.Status.SKIPPED
            )
            if not is_test:
                result.error = "WhatsApp sem envio automático (use o link)."
        elif channel == "internal":
            # Notificação interna: registrada como log/timeline, sem gateway.
            result.status = NotificationLog.Status.SENT
        else:  # sms
            result.status = NotificationLog.Status.SKIPPED
            result.error = "SMS sem provedor configurado."
    except Exception as exc:  # noqa: BLE001 - registra qualquer falha de envio
        result.status = NotificationLog.Status.FAILED
        result.error = str(exc)

    _log(result, work_order, quote, actor, is_test)
    return result


def _log(result, work_order, quote, actor, is_test):
    NotificationLog.objects.create(
        event=result.event,
        channel=result.channel,
        template=result.template,
        recipient=result.recipient[:200],
        subject=result.subject[:200],
        status=result.status,
        error=result.error,
        is_test=is_test,
        work_order=work_order,
        quote=quote if quote is not None else None,
        created_by=actor if getattr(actor, "is_authenticated", False) else None,
    )
