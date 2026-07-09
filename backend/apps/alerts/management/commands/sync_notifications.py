"""Gera avisos baseados em data (OS vencendo/atrasada, pagamentos, estoque...).

Idempotente: pode ser agendado no cron (ex.: a cada hora) sem duplicar avisos.

    docker compose exec backend python manage.py sync_notifications
"""

from django.core.management.base import BaseCommand

from apps.alerts.generators import run_periodic


class Command(BaseCommand):
    help = "Executa as rotinas periódicas da Central de Notificações."

    def handle(self, *args, **options):
        total = run_periodic()
        self.stdout.write(self.style.SUCCESS(f"{total} aviso(s) criado(s)."))
