"""Testes de filtragem de contexto por campo."""

import pytest

from apps.ai_assistant.context import build_context_text

pytestmark = pytest.mark.django_db


def test_context_empty_when_no_groups_allowed(work_order):
    assert build_context_text(work_order, []) == ""


def test_context_includes_only_allowed_groups(work_order):
    # Relato liberado, diagnóstico NÃO.
    text = build_context_text(work_order, ["customer_report"])
    assert "barulho estranho" in text
    assert "bieleta" not in text  # diagnóstico não foi liberado


def test_context_diagnosis_group_includes_diagnosis(work_order):
    text = build_context_text(work_order, ["diagnosis"])
    assert "bieleta" in text


def test_context_customer_group(work_order):
    text = build_context_text(work_order, ["customer"])
    assert "Maria Silva" in text
