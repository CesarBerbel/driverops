from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode


def send_password_reset_email(user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    reset_link = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"

    subject = "Redefinição de senha - DriverOps"
    message = (
        f"Olá, {user.get_short_name()}.\n\n"
        "Recebemos uma solicitação para redefinir a senha da sua conta DriverOps.\n"
        f"Clique no link abaixo para escolher uma nova senha (válido por 1 hora):\n\n"
        f"{reset_link}\n\n"
        "Se você não solicitou essa alteração, ignore este e-mail -- sua senha "
        "permanece inalterada."
    )
    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
    )
