from django.core.management.base import BaseCommand

from apps.smart_search.indexing import rebuild_embeddings


class Command(BaseCommand):
    help = "Recomputa os embeddings das OS (busca semântica). Idempotente."

    def handle(self, *args, **options):
        stats = rebuild_embeddings()
        if stats["unavailable"]:
            self.stderr.write(
                self.style.WARNING(
                    "Provedor de embeddings indisponível (verifique a configuração "
                    "e a chave). Embeddings existentes foram mantidos."
                )
            )
        self.stdout.write(
            self.style.SUCCESS(
                f"Embeddings: {stats['written']} de {stats['total']} pendentes atualizados."
            )
        )
