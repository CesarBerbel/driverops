"""Montagem do prompt final e validação de ação por campo.

O prompt é montado sempre no backend (o frontend nunca escolhe prompts críticos):
regras globais → instrução do campo → estilo/fidelidade → contexto permitido →
ação → texto original. A ação é validada contra as permissões do campo.
"""

from .fields import (
    AUDIENCES,
    DETAIL_LEVELS,
    TONES,
    action_meta,
)

_TONE_LABEL = dict(TONES)
_DETAIL_LABEL = dict(DETAIL_LEVELS)
_AUDIENCE_LABEL = dict(AUDIENCES)


class ActionNotAllowed(Exception):
    """A ação solicitada não é permitida para este campo/config."""


def resolve_action(instruction, action_key):
    """Valida a ação contra as flags do campo. Devolve (label, texto_da_acao)."""
    try:
        label, action_text, required_flag = action_meta(action_key)
    except KeyError:
        raise ActionNotAllowed("Ação de IA desconhecida.")
    if required_flag and not getattr(instruction, required_flag, False):
        raise ActionNotAllowed(
            f"A ação \"{label}\" não está habilitada para o campo "
            f"{instruction.get_field_key_display()}."
        )
    return label, action_text


def _style_lines(instruction):
    lines = [
        f"Tom de linguagem: {_TONE_LABEL.get(instruction.tone, instruction.tone)}.",
        f"Nível de detalhamento: "
        f"{_DETAIL_LABEL.get(instruction.detail_level, instruction.detail_level)}.",
        f"Público-alvo: {_AUDIENCE_LABEL.get(instruction.audience, instruction.audience)}.",
    ]
    if instruction.preserve_technical_terms:
        lines.append("Preserve os termos técnicos exatamente como foram escritos.")
    if instruction.keep_first_person:
        lines.append("Mantenha a primeira pessoa (o texto foi relatado pelo cliente).")
    if instruction.remove_slang:
        lines.append("Remova gírias, mantendo o texto fiel ao conteúdo original.")
    else:
        lines.append("Mantenha o texto fiel ao relato, sem 'corrigir' o estilo do autor.")
    if instruction.visible_to_customer:
        lines.append("Este texto será visível ao cliente: evite expor informações internas.")
    else:
        lines.append("Este texto é de uso interno: não deve ser exibido ao cliente.")
    return lines


def build_system_prompt(settings, instruction, context_text):
    """Monta o system prompt: regras globais + instrução do campo + estilo + contexto."""
    parts = [settings.global_prompt.strip(), ""]
    parts.append(f"Campo: {instruction.name}")
    if instruction.description:
        parts.append(f"Finalidade do campo: {instruction.description}")
    parts.append("")
    parts.append("Instrução específica deste campo:")
    parts.append(instruction.instruction.strip())
    parts.append("")
    parts.append("Diretrizes de estilo e fidelidade:")
    parts.extend(f"- {line}" for line in _style_lines(instruction))
    if context_text:
        parts.append("")
        parts.append(
            "Contexto permitido da OS (use APENAS para embasar o texto; nunca "
            "copie dados que não estejam no texto original nem invente informação):"
        )
        parts.append(context_text)
    return "\n".join(parts).strip()


def build_user_prompt(action_text, original_text):
    return (
        f"Ação solicitada: {action_text}\n\n"
        "Texto original do campo (entre as marcas):\n"
        "<<<TEXTO_ORIGINAL\n"
        f"{original_text}\n"
        "TEXTO_ORIGINAL>>>\n\n"
        "Retorne apenas o texto final do campo."
    )
