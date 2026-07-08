"""Camada de provedores de IA (abstração).

Isola a chamada ao provedor para que views/serviços não conheçam detalhes de SDK.
O provedor padrão/de referência é a **Anthropic (Claude)**, via SDK oficial. Há
adaptadores HTTP para **OpenAI** (e endpoints compatíveis, via ``base_url``) e
**Gemini**. A chave de API vem sempre de variável de ambiente (nunca do banco),
conforme o padrão de segredos do projeto.

Erros de provedor (chave ausente/ inválida, timeout, indisponibilidade) viram
:class:`AIProviderError` com uma ``user_message`` clara e um ``code`` para o
frontend distinguir "configuração incompleta" de "falha temporária".
"""

import os
from dataclasses import dataclass


class AIProviderError(Exception):
    """Falha ao gerar sugestão. Carrega mensagem amigável e código de erro."""

    def __init__(self, user_message, *, code="provider_error", detail=""):
        super().__init__(detail or user_message)
        self.user_message = user_message
        self.code = code
        self.detail = detail


@dataclass
class ProviderResult:
    text: str
    model: str
    input_tokens: int | None = None
    output_tokens: int | None = None


# Variável de ambiente padrão por provedor (pode ser sobrescrita na config).
DEFAULT_KEY_ENV = {
    "anthropic": "ANTHROPIC_API_KEY",
    "openai": "OPENAI_API_KEY",
    "gemini": "GEMINI_API_KEY",
    "custom": "AI_ASSISTANT_API_KEY",
}


def _read_key(settings):
    env_name = (settings.api_key_env or "").strip() or DEFAULT_KEY_ENV.get(
        settings.provider, "AI_ASSISTANT_API_KEY"
    )
    key = os.environ.get(env_name, "").strip()
    if not key:
        raise AIProviderError(
            "A configuração de IA está incompleta. Verifique o provedor e a chave de API.",
            code="config_incomplete",
            detail=f"variável de ambiente {env_name} ausente",
        )
    return key


class BaseProvider:
    def __init__(self, settings):
        self.settings = settings

    def generate(self, *, system, user):  # pragma: no cover - interface
        raise NotImplementedError


class AnthropicProvider(BaseProvider):
    """Provedor padrão. Usa o SDK oficial ``anthropic`` (Messages API).

    Observação: modelos Opus 4.x rejeitam ``temperature``; por isso a temperatura
    configurada NÃO é enviada à Anthropic (fica reservada para OpenAI/Gemini). O
    prompt global instrui a IA a devolver apenas o texto final.
    """

    def generate(self, *, system, user):
        key = _read_key(self.settings)
        try:
            import anthropic
        except ImportError as exc:  # pragma: no cover - dependência do projeto
            raise AIProviderError(
                "O provedor de IA não está disponível no servidor.",
                code="provider_unavailable",
                detail=str(exc),
            )
        client = anthropic.Anthropic(api_key=key, timeout=self.settings.timeout_seconds)
        try:
            message = client.messages.create(
                model=self.settings.model,
                max_tokens=self.settings.max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
        except anthropic.AuthenticationError as exc:
            raise AIProviderError(
                "A configuração de IA está incompleta. Verifique o provedor e a chave de API.",
                code="auth_error",
                detail=str(exc),
            )
        except anthropic.APITimeoutError as exc:
            raise AIProviderError(
                "Não foi possível gerar a sugestão agora. O texto original foi preservado.",
                code="timeout",
                detail=str(exc),
            )
        except anthropic.APIConnectionError as exc:
            raise AIProviderError(
                "Não foi possível gerar a sugestão agora. O texto original foi preservado.",
                code="unavailable",
                detail=str(exc),
            )
        except anthropic.APIStatusError as exc:
            raise AIProviderError(
                "Não foi possível gerar a sugestão agora. O texto original foi preservado.",
                code="provider_error",
                detail=str(exc),
            )
        except Exception as exc:  # noqa: BLE001
            raise AIProviderError(
                "Não foi possível gerar a sugestão agora. O texto original foi preservado.",
                code="provider_error",
                detail=str(exc),
            )

        if getattr(message, "stop_reason", None) == "refusal":
            raise AIProviderError(
                "A IA não pôde processar este conteúdo. O texto original foi preservado.",
                code="refusal",
            )
        text = "".join(
            block.text for block in message.content if getattr(block, "type", "") == "text"
        ).strip()
        usage = getattr(message, "usage", None)
        return ProviderResult(
            text=text,
            model=getattr(message, "model", self.settings.model),
            input_tokens=getattr(usage, "input_tokens", None) if usage else None,
            output_tokens=getattr(usage, "output_tokens", None) if usage else None,
        )


class _HTTPProvider(BaseProvider):
    """Base para provedores HTTP simples (OpenAI-compatível / Gemini)."""

    def _post(self, url, headers, payload):
        import requests

        try:
            resp = requests.post(
                url, headers=headers, json=payload, timeout=self.settings.timeout_seconds
            )
        except requests.Timeout as exc:
            raise AIProviderError(
                "Não foi possível gerar a sugestão agora. O texto original foi preservado.",
                code="timeout",
                detail=str(exc),
            )
        except requests.RequestException as exc:
            raise AIProviderError(
                "Não foi possível gerar a sugestão agora. O texto original foi preservado.",
                code="unavailable",
                detail=str(exc),
            )
        if resp.status_code in (401, 403):
            raise AIProviderError(
                "A configuração de IA está incompleta. Verifique o provedor e a chave de API.",
                code="auth_error",
                detail=resp.text[:300],
            )
        if resp.status_code >= 400:
            raise AIProviderError(
                "Não foi possível gerar a sugestão agora. O texto original foi preservado.",
                code="provider_error",
                detail=resp.text[:300],
            )
        return resp.json()


class OpenAIProvider(_HTTPProvider):
    """OpenAI e endpoints compatíveis (via ``base_url`` para o provedor custom)."""

    def generate(self, *, system, user):
        key = _read_key(self.settings)
        base = (self.settings.base_url or "https://api.openai.com/v1").rstrip("/")
        payload = {
            "model": self.settings.model,
            "max_tokens": self.settings.max_tokens,
            "temperature": self.settings.temperature,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        data = self._post(
            f"{base}/chat/completions",
            {"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            payload,
        )
        try:
            text = data["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, TypeError) as exc:
            raise AIProviderError(
                "Não foi possível gerar a sugestão agora. O texto original foi preservado.",
                code="provider_error",
                detail=str(exc),
            )
        usage = data.get("usage") or {}
        return ProviderResult(
            text=text,
            model=data.get("model", self.settings.model),
            input_tokens=usage.get("prompt_tokens"),
            output_tokens=usage.get("completion_tokens"),
        )


class GeminiProvider(_HTTPProvider):
    def generate(self, *, system, user):
        key = _read_key(self.settings)
        base = (self.settings.base_url or "https://generativelanguage.googleapis.com/v1beta").rstrip("/")
        url = f"{base}/models/{self.settings.model}:generateContent?key={key}"
        payload = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {
                "maxOutputTokens": self.settings.max_tokens,
                "temperature": self.settings.temperature,
            },
        }
        data = self._post(url, {"Content-Type": "application/json"}, payload)
        try:
            parts = data["candidates"][0]["content"]["parts"]
            text = "".join(p.get("text", "") for p in parts).strip()
        except (KeyError, IndexError, TypeError) as exc:
            raise AIProviderError(
                "Não foi possível gerar a sugestão agora. O texto original foi preservado.",
                code="provider_error",
                detail=str(exc),
            )
        usage = data.get("usageMetadata") or {}
        return ProviderResult(
            text=text,
            model=self.settings.model,
            input_tokens=usage.get("promptTokenCount"),
            output_tokens=usage.get("candidatesTokenCount"),
        )


_PROVIDERS = {
    "anthropic": AnthropicProvider,
    "openai": OpenAIProvider,
    "gemini": GeminiProvider,
    "custom": OpenAIProvider,  # custom usa protocolo OpenAI-compatível + base_url
}


def get_provider(settings):
    cls = _PROVIDERS.get(settings.provider)
    if cls is None:
        raise AIProviderError(
            "Provedor de IA não suportado.",
            code="provider_unavailable",
            detail=settings.provider,
        )
    return cls(settings)
