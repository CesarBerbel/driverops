"""Geração do texto de abordagem via IA (reutiliza o provider de ai_assistant).

Nunca monta prompt crítico no frontend: o contexto é montado aqui, no backend,
com campos seguros. Falha de IA degrada para o template determinístico.
"""

from apps.ai_assistant.models import AISettings, AIUsageLog
from apps.ai_assistant.providers import AIProviderError, get_provider

from .models import Channel, CrmSettings


def _context(suggestion, conf):
    """Contexto seguro (sem observações internas / financeiro por padrão)."""
    customer = suggestion.customer
    vehicle = suggestion.vehicle
    parts = [
        f"Tipo de sugestão: {suggestion.get_suggestion_type_display()}.",
        f"Motivo: {suggestion.reason}",
        f"Canal: {suggestion.get_channel_display()}.",
        f"Tom desejado: {conf.tone}.",
    ]
    if customer:
        first = (customer.name or "cliente").split(" ")[0]
        parts.append(f"Primeiro nome do cliente: {first}.")
    if vehicle:
        parts.append(f"Placa do veículo: {vehicle.license_plate}.")
    parts.append(
        "Gere uma mensagem curta, cordial e profissional para o cliente, adequada "
        "ao canal, sem inventar dados, sem prometer prazo/desconto/diagnóstico e "
        "sem expor informações internas. Responda apenas com o texto da mensagem."
    )
    return "\n".join(parts)


def _log(user, action, provider, model, status, *, error_code="", error=""):
    return AIUsageLog.objects.create(
        user=user if getattr(user, "is_authenticated", False) else None,
        field_key="crm",
        action=action,
        provider=provider,
        model=model,
        status=status,
        error_code=error_code,
        error=error[:2000],
    )


def generate_message(suggestion, user):
    """Devolve {text, ai_used, reason?}. Fallback: o template da sugestão."""
    conf = CrmSettings.get_solo()
    fallback = suggestion.suggested_text or ""
    if not (conf.is_active and conf.allow_ai_messages):
        return {"text": fallback, "ai_used": False, "reason": "crm_ai_disabled"}

    ai_settings = AISettings.get_solo()
    if not ai_settings.is_active:
        return {"text": fallback, "ai_used": False, "reason": "ai_disabled"}

    system = conf.global_prompt
    user_prompt = _context(suggestion, conf)
    try:
        provider = get_provider(ai_settings)
        result = provider.generate(system=system, user=user_prompt)
    except AIProviderError as exc:
        _log(
            user,
            "crm_message",
            ai_settings.provider,
            ai_settings.model,
            AIUsageLog.Status.FAILED,
            error_code=exc.code,
            error=exc.user_message,
        )
        return {
            "text": fallback,
            "ai_used": False,
            "reason": exc.code,
            "error": exc.user_message,
        }

    text = (result.text or "").strip() or fallback
    _log(
        user,
        "crm_message",
        ai_settings.provider,
        result.model or ai_settings.model,
        AIUsageLog.Status.SUCCESS,
    )
    return {
        "text": text,
        "ai_used": True,
        "channel": suggestion.channel or Channel.WHATSAPP,
    }
