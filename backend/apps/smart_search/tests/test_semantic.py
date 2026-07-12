"""Busca semântica (embeddings): usa um embedder FALSO determinístico (sem rede).

O embedder de teste mapeia cada texto para um vetor de "conceitos" que NÃO estão
na lista de sinônimos automáticos -- assim a busca lexical genuinamente erra e só
a semântica acerta a paráfrase.
"""

import pytest

from apps.orders.models import WorkOrder
from apps.smart_search import embeddings as emb_mod
from apps.smart_search.indexing import rebuild_embeddings
from apps.smart_search.intent import deaccent
from apps.smart_search.models import SmartSearchSettings, WorkOrderEmbedding

from .conftest import login, make_user

pytestmark = pytest.mark.django_db

SMART = "/api/search/smart/"

# Conceitos do embedder de teste. Nenhum é sinônimo automático (freio, óleo...),
# então a busca lexical não liga "vazamento" a "perda de líquido".
CONCEPTS = {
    "leak": ["vazamento", "perda", "liquido", "fluido", "gotejando"],
    "smell": ["cheiro", "fumaca", "queimado", "odor"],
}


def fake_embed(texts, settings_obj):
    vectors = []
    for text in texts:
        d = deaccent(text)
        vectors.append(
            [1.0 if any(w in d for w in words) else 0.0 for words in CONCEPTS.values()]
        )
    return vectors


@pytest.fixture
def semantic_on(db, monkeypatch):
    conf = SmartSearchSettings.get_solo()
    conf.semantic_enabled = True
    conf.similarity_threshold = 0.6
    conf.save()
    monkeypatch.setattr(emb_mod, "embed_texts", fake_embed)
    return conf


def _os(customer, vehicle, report, **extra):
    return WorkOrder.objects.create(
        customer=customer,
        vehicle=vehicle,
        opened_at="2026-01-10",
        status="in_progress",
        customer_report=report,
        **extra,
    )


def _post(client, query):
    return client.post(SMART, data={"query": query}, content_type="application/json")


def _wo_ids(payload):
    return {r["id"] for r in payload["results"] if r["type"] == "work_order"}


# --------------------------------------------------------------------------- #
# Unit: texto-fonte e cosseno
# --------------------------------------------------------------------------- #
def test_source_text_excludes_internal_notes(customer, vehicle):
    order = _os(customer, vehicle, "barulho ao frear", internal_notes="SEGREDO INTERNO")
    text = emb_mod.source_text(order)
    assert "barulho" in text.lower()
    assert "segredo" not in text.lower()  # observação interna NÃO entra no embedding


def test_cosine_basics():
    assert emb_mod.cosine([1, 0], [1, 0]) == pytest.approx(1.0)
    assert emb_mod.cosine([1, 0], [0, 1]) == pytest.approx(0.0)
    assert emb_mod.cosine([], [1]) == 0.0


# --------------------------------------------------------------------------- #
# Busca semântica de ponta a ponta
# --------------------------------------------------------------------------- #
def test_semantic_finds_paraphrase_lexical_misses(
    full_client, customer, vehicle, semantic_on
):
    order = _os(customer, vehicle, "perda de líquido embaixo do veículo")
    stats = rebuild_embeddings()
    assert stats["written"] == 1

    payload = _post(full_client, "vazamento de fluido").json()
    assert order.id in _wo_ids(payload)
    assert payload["used_semantic"] is True
    result = next(r for r in payload["results"] if r["id"] == order.id)
    assert "significado" in result["reason"].lower()


def test_semantic_respects_threshold(full_client, customer, vehicle, semantic_on):
    # Doc só com o conceito "leak"; pergunta com "leak" + "smell" -> cosseno ~0.707.
    order = _os(customer, vehicle, "perda de líquido no motor")
    rebuild_embeddings()

    semantic_on.similarity_threshold = 0.8  # acima de 0.707 -> exclui
    semantic_on.save()
    payload = _post(full_client, "vazamento com cheiro de queimado").json()
    assert order.id not in _wo_ids(payload)

    semantic_on.similarity_threshold = 0.5  # abaixo de 0.707 -> inclui
    semantic_on.save()
    payload2 = _post(full_client, "vazamento com cheiro de queimado").json()
    assert order.id in _wo_ids(payload2)


def test_semantic_disabled_by_default(full_client, customer, vehicle):
    # Sem semantic_enabled, a paráfrase não é encontrada (só lexical).
    order = _os(customer, vehicle, "perda de líquido embaixo do veículo")
    payload = _post(full_client, "vazamento de fluido").json()
    assert order.id not in _wo_ids(payload)
    assert payload["used_semantic"] is False


def test_falls_back_to_lexical_when_provider_unavailable(
    full_client, customer, vehicle, monkeypatch
):
    conf = SmartSearchSettings.get_solo()
    conf.semantic_enabled = True
    conf.save()
    monkeypatch.setattr(emb_mod, "embed_texts", lambda texts, s: None)  # provedor caído

    _os(customer, vehicle, "revisão completa feita")
    stats = rebuild_embeddings()
    assert stats["unavailable"] is True
    assert WorkOrderEmbedding.objects.count() == 0

    # A busca continua funcionando no modo lexical.
    payload = _post(full_client, "revisão completa").json()
    assert payload["used_semantic"] is False
    assert len(payload["results"]) >= 1


def test_rebuild_is_idempotent_by_hash(customer, vehicle, semantic_on):
    _os(customer, vehicle, "perda de líquido")
    assert rebuild_embeddings()["written"] == 1
    # Sem mudança no texto -> nada a recomputar.
    assert rebuild_embeddings()["written"] == 0


def test_semantic_still_respects_date_filter(
    full_client, customer, vehicle, semantic_on
):
    # OS semanticamente próxima, mas fora do período pedido, não deve aparecer.
    old = _os(customer, vehicle, "perda de líquido")
    WorkOrder.objects.filter(id=old.id).update(opened_at="2020-05-05")
    rebuild_embeddings()
    payload = _post(full_client, "vazamento de fluido do ano passado").json()
    assert old.id not in _wo_ids(payload)


def test_settings_validates_threshold_bounds():
    client = login(make_user("cfg@example.com", ["settings.view", "settings.edit"]))
    r = client.patch(
        "/api/settings/smart-search/",
        data={"similarity_threshold": 2.0},
        content_type="application/json",
    )
    assert r.status_code == 400
