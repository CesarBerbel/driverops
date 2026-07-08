"""Testes da camada de provedores (degradação graciosa)."""

import pytest

from apps.ai_assistant.models import AISettings
from apps.ai_assistant.providers import AIProviderError, get_provider

pytestmark = pytest.mark.django_db


def test_missing_api_key_raises_config_incomplete(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    settings = AISettings.get_solo()
    settings.provider = "anthropic"
    settings.api_key_env = "ANTHROPIC_API_KEY"
    settings.save()
    provider = get_provider(settings)
    with pytest.raises(AIProviderError) as exc:
        provider.generate(system="s", user="u")
    assert exc.value.code == "config_incomplete"


def test_unknown_provider_raises():
    settings = AISettings.get_solo()
    settings.provider = "bogus"
    with pytest.raises(AIProviderError) as exc:
        get_provider(settings)
    assert exc.value.code == "provider_unavailable"
