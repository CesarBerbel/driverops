"""Envio do orçamento ao cliente.

O conteúdo passa pelo motor de templates (evento ``quote_sent``): o template
padrão já inclui o link seguro de aprovação (``{{orcamento.link_aprovacao}}``).
Se o template estiver inválido, cai num envio simples em texto para não deixar o
cliente sem o link.
"""

from django.conf import settings
from django.core.mail import send_mail

from apps.notifications.services import send_notification


def _send_plain(quote, to_email):
    link = f"{settings.FRONTEND_URL}/orcamento/{quote.public_token}"
    customer = quote.work_order.customer
    subject = f"Orçamento #{quote.number:04d} - DriverOps"
    message = (
        f"Olá, {customer.name}.\n\n"
        "Segue o orçamento dos serviços do seu veículo para sua avaliação.\n"
        f"Ordem de Serviço nº {quote.work_order.number:04d} - "
        f"Orçamento nº {quote.number:04d} (versão {quote.version}).\n\n"
        "Acesse o link abaixo para visualizar, aprovar ou recusar o orçamento:\n\n"
        f"{link}\n\n"
        "O link é pessoal e não exige login. "
        "Em caso de dúvidas, entre em contato com a oficina."
    )
    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[to_email],
    )


def send_quote_approval_email(quote, to_email, actor=None):
    """Envia ao cliente o link seguro (token) da página pública de aprovação."""
    result = send_notification(
        "quote_sent",
        channel="email",
        quote=quote,
        actor=actor,
        to=to_email,
    )
    if not result.ok:
        # Fallback seguro: template inválido não pode impedir o envio do link.
        _send_plain(quote, to_email)
