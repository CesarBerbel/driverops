"""Gera as sugestões do CRM inteligente (motor de regras determinístico).

Idempotente (dedup por chave); agendável no cron junto com sync_notifications.

    docker compose exec backend python manage.py sync_crm
"""

import logging
import time

from django.core.management.base import BaseCommand

from apps.crm.rules import run_rules

logger = logging.getLogger("apps.jobs")


class Command(BaseCommand):
    help = "Executa o motor de regras do CRM inteligente."

    def handle(self, *args, **options):
        started = time.monotonic()
        logger.info("sync_crm: iniciando")
        try:
            created = run_rules()
        except Exception:
            logger.exception("sync_crm: FALHOU")
            raise
        elapsed = time.monotonic() - started
        logger.info(
            "sync_crm: %s sugestão(ões) criada(s) em %.2fs", len(created), elapsed
        )
        self.stdout.write(
            self.style.SUCCESS(f"{len(created)} sugestão(ões) criada(s).")
        )
