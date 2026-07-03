import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

User = get_user_model()


class Command(BaseCommand):
    help = (
        "Cria ou atualiza (idempotente) o superusuário de desenvolvimento a partir "
        "das variáveis de ambiente DJANGO_SUPERUSER_EMAIL, DJANGO_SUPERUSER_PASSWORD "
        "e DJANGO_SUPERUSER_NAME (opcional). Seguro para rodar múltiplas vezes: nunca "
        "cria duplicidade, apenas atualiza os dados/permissões do usuário existente."
    )

    def handle(self, *args, **options):
        email = os.environ.get("DJANGO_SUPERUSER_EMAIL")
        password = os.environ.get("DJANGO_SUPERUSER_PASSWORD")
        full_name = os.environ.get("DJANGO_SUPERUSER_NAME", "Admin")

        if not email or not password:
            raise CommandError(
                "DJANGO_SUPERUSER_EMAIL e DJANGO_SUPERUSER_PASSWORD são obrigatórios. "
                "Defina-os no arquivo .env (veja .env.example)."
            )

        user, created = User.objects.get_or_create(
            email=email,
            defaults={"full_name": full_name},
        )
        user.full_name = full_name
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.set_password(password)
        user.save()

        action = "criado" if created else "atualizado"
        self.stdout.write(
            self.style.SUCCESS(f"Superusuário {action} com sucesso: {email}")
        )
