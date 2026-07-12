"""Camada de provedor de embeddings (embeddings.embed_texts) -- sem rede.

Mocka ``requests.post`` para cobrir o parsing da resposta e o tratamento de
falhas (sem chave, erro HTTP, tamanho divergente) que devem virar fallback.
"""

import pytest
import requests

from apps.smart_search import embeddings as emb
from apps.smart_search.models import SmartSearchSettings

pytestmark = pytest.mark.django_db


class FakeResp:
    def __init__(self, payload, http_error=False):
        self._payload = payload
        self._http_error = http_error

    def raise_for_status(self):
        if self._http_error:
            raise requests.HTTPError("500")

    def json(self):
        return self._payload


def _conf():
    conf = SmartSearchSettings.get_solo()
    conf.embedding_api_key_env = "TEST_EMB_KEY"
    conf.embedding_model = "m-test"
    conf.embedding_dimensions = 4
    conf.embedding_base_url = "https://api.example.com/v1/"
    return conf


def test_embed_texts_empty_shortcircuits():
    assert emb.embed_texts([], _conf()) == []


def test_embed_texts_none_without_key(monkeypatch):
    monkeypatch.delenv("TEST_EMB_KEY", raising=False)
    assert emb.embed_texts(["a"], _conf()) is None


def test_embed_texts_parses_and_sorts_by_index(monkeypatch):
    monkeypatch.setenv("TEST_EMB_KEY", "sk-test")
    captured = {}

    def fake_post(url, **kwargs):
        captured["url"] = url
        captured["json"] = kwargs["json"]
        captured["auth"] = kwargs["headers"]["Authorization"]
        # Devolve fora de ordem de propósito -> a função deve reordenar por index.
        return FakeResp(
            {
                "data": [
                    {"index": 1, "embedding": [0.9]},
                    {"index": 0, "embedding": [0.1]},
                ]
            }
        )

    monkeypatch.setattr(emb.requests, "post", fake_post)
    vectors = emb.embed_texts(["a", "b"], _conf())

    assert vectors == [[0.1], [0.9]]
    assert captured["url"] == "https://api.example.com/v1/embeddings"  # sem barra dupla
    assert captured["json"]["input"] == ["a", "b"]
    assert captured["json"]["dimensions"] == 4
    assert captured["auth"] == "Bearer sk-test"


def test_embed_texts_none_on_http_error(monkeypatch):
    monkeypatch.setenv("TEST_EMB_KEY", "sk-test")
    monkeypatch.setattr(
        emb.requests, "post", lambda url, **kw: FakeResp({}, http_error=True)
    )
    assert emb.embed_texts(["a"], _conf()) is None


def test_embed_texts_none_on_length_mismatch(monkeypatch):
    monkeypatch.setenv("TEST_EMB_KEY", "sk-test")
    # Pede 2, provedor devolve 1 -> resposta inconsistente -> None (fallback).
    monkeypatch.setattr(
        emb.requests,
        "post",
        lambda url, **kw: FakeResp({"data": [{"index": 0, "embedding": [0.1]}]}),
    )
    assert emb.embed_texts(["a", "b"], _conf()) is None


def test_embed_query_uses_embed_texts(monkeypatch):
    monkeypatch.setenv("TEST_EMB_KEY", "sk-test")
    monkeypatch.setattr(
        emb.requests,
        "post",
        lambda url, **kw: FakeResp({"data": [{"index": 0, "embedding": [1.0, 2.0]}]}),
    )
    assert emb.embed_query("teste", _conf()) == [1.0, 2.0]
