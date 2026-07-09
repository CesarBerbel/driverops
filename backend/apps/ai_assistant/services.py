"""Camada de serviço da IA.

Ponto único por onde passam as gerações (reais e de teste). Responsável por:
carregar config global e instrução do campo, validar permissão/ação, montar o
prompt seguro, filtrar o contexto permitido, chamar o provedor, tratar
erro/timeout e registrar o log de uso. Views não chamam o provedor diretamente.
"""

from dataclasses import dataclass

from apps.accounts.audit import client_ip

from .context import build_context_text
from .fields import default_field
from .models import AIFieldInstruction, AISettings, AIUsageLog
from .prompt import build_system_prompt, build_user_prompt, resolve_action
from .providers import AIProviderError, get_provider


class AIDisabledError(Exception):
    """O módulo de IA (ou o campo) está inativo."""

    def __init__(self, message, *, code="ai_disabled"):
        super().__init__(message)
        self.user_message = message
        self.code = code


@dataclass
class Suggestion:
    suggestion: str
    field_key: str
    action: str
    provider: str
    model: str
    log_id: int | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None


def get_instruction(field_key):
    """Instrução ativa do campo; materializa o padrão (não salvo) se faltar."""
    instruction = AIFieldInstruction.objects.filter(field_key=field_key).first()
    if instruction is not None:
        return instruction
    defaults = default_field(field_key)
    return AIFieldInstruction(field_key=field_key, **defaults)


def _log(
    *,
    user,
    work_order,
    field_key,
    action,
    settings,
    result,
    status,
    error_code="",
    error="",
    request=None,
    is_test=False,
    system="",
    user_text="",
):
    log_texts = settings.log_texts
    return AIUsageLog.objects.create(
        user=user if getattr(user, "is_authenticated", False) else None,
        work_order=work_order,
        field_key=field_key,
        action=action,
        provider=settings.provider,
        model=(result.model if result else settings.model),
        status=status,
        error_code=error_code,
        error=error[:2000],
        input_tokens=result.input_tokens if result else None,
        output_tokens=result.output_tokens if result else None,
        is_test=is_test,
        input_text=(user_text[:8000] if log_texts else ""),
        output_text=((result.text[:8000] if result else "") if log_texts else ""),
        ip=client_ip(request) if request is not None else None,
        user_agent=(
            request.META.get("HTTP_USER_AGENT", "")[:500] if request is not None else ""
        ),
    )


def generate_suggestion(
    *,
    user,
    field_key,
    action,
    original_text,
    work_order=None,
    request=None,
    is_test=False,
):
    """Gera uma sugestão de IA para um campo/ação. Levanta erro tratável em falha.

    Nunca substitui o texto do usuário: apenas devolve a sugestão. Sempre registra
    log (sucesso ou falha). Não vaza contexto além do permitido para o campo.
    """
    settings = AISettings.get_solo()
    if not settings.is_active:
        raise AIDisabledError(
            "O assistente de IA está desativado. Ative-o em Configurações.",
            code="ai_disabled",
        )

    instruction = get_instruction(field_key)
    if not instruction.is_active:
        raise AIDisabledError(
            "A IA está desativada para este campo.", code="field_disabled"
        )

    # Valida a ação contra as permissões do campo (backend é a autoridade).
    label, action_text = resolve_action(instruction, action)

    context_text = ""
    if instruction.use_context and work_order is not None:
        context_text = build_context_text(work_order, instruction.allowed_context)

    system = build_system_prompt(settings, instruction, context_text)
    user_prompt = build_user_prompt(action_text, original_text or "")

    provider = get_provider(settings)
    try:
        result = provider.generate(system=system, user=user_prompt)
    except AIProviderError as exc:
        _log(
            user=user,
            work_order=work_order,
            field_key=field_key,
            action=action,
            settings=settings,
            result=None,
            status=AIUsageLog.Status.FAILED,
            error_code=exc.code,
            error=exc.detail or exc.user_message,
            request=request,
            is_test=is_test,
            user_text=original_text or "",
        )
        raise

    if not result.text.strip():
        _log(
            user=user,
            work_order=work_order,
            field_key=field_key,
            action=action,
            settings=settings,
            result=result,
            status=AIUsageLog.Status.FAILED,
            error_code="empty",
            error="Resposta vazia do provedor.",
            request=request,
            is_test=is_test,
            user_text=original_text or "",
        )
        raise AIProviderError(
            "Não foi possível gerar a sugestão agora. O texto original foi preservado.",
            code="empty",
        )

    log = _log(
        user=user,
        work_order=work_order,
        field_key=field_key,
        action=action,
        settings=settings,
        result=result,
        status=AIUsageLog.Status.SUCCESS,
        request=request,
        is_test=is_test,
        user_text=original_text or "",
    )
    return Suggestion(
        suggestion=result.text.strip(),
        field_key=field_key,
        action=action,
        provider=settings.provider,
        model=result.model,
        log_id=log.id,
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
    )
