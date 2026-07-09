"""Gera as sugestões do CRM inteligente (motor de regras determinístico).

Idempotente (dedup por chave); agendável no cron junto com sync_notifications.

    docker compose exec backend python manage.py sync_crm
"""

from django.core.management.base import BaseCommand

from apps.crm.rules import run_rules


class Command(BaseCommand):
    help = "Executa o motor de regras do CRM inteligente."

    def handle(self, *args, **options):
        created = run_rules()
        self.stdout.write(
            self.style.SUCCESS(f"{len(created)} sugestão(ões) criada(s).")
        )
