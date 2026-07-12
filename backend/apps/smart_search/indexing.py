"""(Re)construção dos embeddings das OS.

Recomputa apenas quando o texto-fonte muda (comparação por hash), então pode ser
rodado periodicamente (cron/comando) sem custo desnecessário de chamadas ao
provedor. Se o provedor estiver indisponível, aborta sem apagar o que já existe.
"""

import logging

from apps.orders.models import WorkOrder

from . import embeddings
from .models import SmartSearchSettings, WorkOrderEmbedding

logger = logging.getLogger(__name__)


def _pending(orders):
    """Devolve [(order, text, hash)] apenas das OS cujo texto mudou/faltou."""
    existing = {
        e.order_id: e.source_hash
        for e in WorkOrderEmbedding.objects.filter(order__in=orders)
    }
    pending = []
    for order in orders:
        text = embeddings.source_text(order)
        if not text:
            continue
        digest = embeddings.text_hash(text)
        if existing.get(order.id) != digest:
            pending.append((order, text, digest))
    return pending


def rebuild_embeddings(orders=None, *, batch_size=64):
    """Recomputa embeddings das OS ativas (ou de ``orders``). Idempotente."""
    conf = SmartSearchSettings.get_solo()
    if orders is None:
        orders = WorkOrder.objects.filter(is_active=True)
    orders = orders.select_related("customer", "vehicle").prefetch_related(
        "service_items__service", "part_items__part"
    )

    pending = _pending(list(orders))
    stats = {"total": len(pending), "written": 0, "unavailable": False}
    if not pending:
        return stats

    for start in range(0, len(pending), batch_size):
        chunk = pending[start : start + batch_size]
        vectors = embeddings.embed_texts([text for _, text, _ in chunk], conf)
        if vectors is None:
            # Provedor indisponível: não apaga o que já existe; sinaliza e para.
            stats["unavailable"] = True
            logger.warning("smart_search: provedor de embeddings indisponível")
            break
        for (order, _text, digest), vector in zip(chunk, vectors):
            WorkOrderEmbedding.objects.update_or_create(
                order=order,
                defaults={
                    "embedding": vector,
                    "source_hash": digest,
                    "model": conf.embedding_model,
                },
            )
            stats["written"] += 1
    return stats
