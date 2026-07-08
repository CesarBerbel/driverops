"""Testes de montagem de prompt e validação de ação por campo."""

import pytest

from apps.ai_assistant.models import AISettings
from apps.ai_assistant.prompt import (
    ActionNotAllowed,
    build_system_prompt,
    build_user_prompt,
    resolve_action,
)
from apps.ai_assistant.services import get_instruction

pytestmark = pytest.mark.django_db


def test_system_prompt_includes_global_rules_and_field_instruction():
    settings = AISettings.get_solo()
    instr = get_instruction("diagnosis")
    system = build_system_prompt(settings, instr, "")
    assert "Nunca invente informações" in system
    assert "Diagnóstico Técnico" in system
    assert "Tom de linguagem" in system


def test_system_prompt_includes_allowed_context_when_present():
    settings = AISettings.get_solo()
    instr = get_instruction("diagnosis")
    system = build_system_prompt(settings, instr, "- Relato do cliente: barulho")
    assert "Contexto permitido da OS" in system
    assert "barulho" in system


def test_user_prompt_wraps_original_text():
    prompt = build_user_prompt("Corrija o texto.", "carro faz barulho")
    assert "carro faz barulho" in prompt
    assert "TEXTO_ORIGINAL" in prompt


def test_resolve_action_blocks_rewrite_on_customer_report():
    instr = get_instruction("customer_report")  # can_rewrite=False
    with pytest.raises(ActionNotAllowed):
        resolve_action(instr, "professional")


def test_resolve_action_allows_fix_grammar_on_customer_report():
    instr = get_instruction("customer_report")
    label, text = resolve_action(instr, "fix_grammar")
    assert "ortografia" in text.lower()


def test_resolve_action_unknown_action():
    instr = get_instruction("diagnosis")
    with pytest.raises(ActionNotAllowed):
        resolve_action(instr, "nonexistent")
