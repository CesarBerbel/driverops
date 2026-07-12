"""Embeddings da Busca Inteligente (busca semântica).

Calcula vetores para o texto das OS e para a pergunta, permitindo encontrar
registros por SIGNIFICADO. O provedor é um endpoint compatível com OpenAI
(``POST {base_url}/embeddings``); a chave vem SEMPRE de variável de ambiente.

Tudo aqui é tolerante a falha: se a busca semântica estiver desligada, sem
chave, ou o provedor falhar, as funções devolvem ``None`` e a busca continua no
modo lexical (fallback), sem quebrar. Apenas texto visível ao cliente é embutido
-- observações internas nunca entram, para não vazar por similaridade.
"""

import hashlib
import math
import os

import requests

_TIMEOUT = 20


def source_text(order):
    """Texto (visível ao cliente) da OS usado para o embedding."""
    parts = [order.customer_report, order.diagnosis]
    parts += [
        item.description or (item.service.name if item.service_id else "")
        for item in order.service_items.all()
    ]
    parts += [
        item.description or (item.part.name if item.part_id else "")
        for item in order.part_items.all()
    ]
    parts += [order.vehicle.brand, order.vehicle.model, order.customer.name]
    return " ".join(p for p in parts if p).strip()


def text_hash(text):
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()


def cosine(a, b):
    """Similaridade de cosseno entre dois vetores (Python puro)."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = 0.0
    na = 0.0
    nb = 0.0
    for x, y in zip(a, b):
        dot += x * y
        na += x * x
        nb += y * y
    if na == 0.0 or nb == 0.0:
        return 0.0
    return dot / (math.sqrt(na) * math.sqrt(nb))


def _api_key(settings_obj):
    env = (settings_obj.embedding_api_key_env or "SMART_SEARCH_EMBEDDING_KEY").strip()
    return os.environ.get(env, "").strip()


def embed_texts(texts, settings_obj):
    """Devolve os vetores dos ``texts`` (mesma ordem), ou ``None`` se indisponível.

    Nunca levanta exceção: qualquer falha do provedor vira ``None`` (fallback).
    """
    if not texts:
        return []
    key = _api_key(settings_obj)
    if not key:
        return None

    base = (settings_obj.embedding_base_url or "https://api.openai.com/v1").rstrip("/")
    payload = {"model": settings_obj.embedding_model, "input": list(texts)}
    if settings_obj.embedding_dimensions:
        payload["dimensions"] = settings_obj.embedding_dimensions
    try:
        resp = requests.post(
            f"{base}/embeddings",
            headers={"Authorization": f"Bearer {key}"},
            json=payload,
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        rows = sorted(resp.json()["data"], key=lambda d: d.get("index", 0))
        vectors = [row["embedding"] for row in rows]
        if len(vectors) != len(texts):
            return None
        return vectors
    except Exception:
        return None


def embed_query(text, settings_obj):
    """Vetor de uma única pergunta, ou ``None``."""
    vectors = embed_texts([text], settings_obj)
    return vectors[0] if vectors else None
