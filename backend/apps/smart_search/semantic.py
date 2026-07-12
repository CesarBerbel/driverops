"""Pontuação semântica: OS mais próximas da pergunta por similaridade vetorial.

Complementa a busca lexical. Se a busca semântica estiver desligada, sem chave ou
o provedor falhar, devolve ``{}`` -- e a busca segue só no modo lexical.
"""

from . import embeddings
from .models import WorkOrderEmbedding

# Teto de OS avaliadas por busca (cosseno em Python é O(n); protege a latência).
_MAX_CANDIDATES = 3000


def semantic_work_order_scores(query_text, settings_obj):
    """Devolve {order_id: similaridade} das OS acima do limiar configurado."""
    if not getattr(settings_obj, "semantic_enabled", False):
        return {}

    query_vec = embeddings.embed_query(query_text, settings_obj)
    if not query_vec:
        return {}

    threshold = settings_obj.similarity_threshold
    rows = (
        WorkOrderEmbedding.objects.filter(order__is_active=True)
        .order_by("-updated_at")
        .values_list("order_id", "embedding")[:_MAX_CANDIDATES]
    )

    scores = {}
    for order_id, vector in rows:
        sim = embeddings.cosine(query_vec, vector)
        if sim >= threshold:
            scores[order_id] = sim
    return scores
