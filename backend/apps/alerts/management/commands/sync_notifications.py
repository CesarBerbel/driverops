"""Gera avisos baseados em data (OS vencendo/atrasada, pagamentos, estoque...).

Idempotente: pode ser agendado no cron (ex.: a cada hora) sem duplicar avisos.

    docker compose exec backend python manage.py sync_notifications
"""

import logging
import time

from django.core.management.base import BaseCommand

from apps.alerts.generators import run_periodic

# Logger dedicado a jobs periódicos -- facilita filtrar/observar em produção.
logger = logging.getLogger("apps.jobs")


class Command(BaseCommand):
    help = "Executa as rotinas periódicas da Central de Notificações."

    def handle(self, *args, **options):
        started = time.monotonic()
        logger.info("sync_notifications: iniciando")
        try:
            total = run_periodic()
        except Exception:
            logger.exception("sync_notifications: FALHOU")
            raise
        elapsed = time.monotonic() - started
        logger.info(
            "sync_notifications: %s aviso(s) criado(s) em %.2fs", total, elapsed
        )
        self.stdout.write(self.style.SUCCESS(f"{total} aviso(s) criado(s)."))
