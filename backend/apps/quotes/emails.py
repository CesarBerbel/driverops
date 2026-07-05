from django.conf import settings
from django.core.mail import send_mail


def send_quote_approval_email(quote, to_email):
    """Envia ao cliente o link seguro (token) da página pública de aprovação."""
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
