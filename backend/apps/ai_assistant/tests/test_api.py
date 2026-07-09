"""Testes da API do Assistente de IA."""

from unittest.mock import patch

import pytest

from apps.accounts.models import AuditLog
from apps.ai_assistant.models import AIFieldInstruction, AISettings, AIUsageLog
from apps.ai_assistant.providers import AIProviderError, ProviderResult

pytestmark = pytest.mark.django_db

GEN = "/api/ai/generate/"


def _mock_generate(text="Sugestão gerada.", **kw):
    return ProviderResult(
        text=text, model="claude-opus-4-8", input_tokens=12, output_tokens=8, **kw
    )


# --- configuração / metadados ---


def test_metadata_requires_view_permission(admin_client, estoque_client):
    assert admin_client.get("/api/ai/metadata/").status_code == 200
    assert estoque_client.get("/api/ai/metadata/").status_code == 403


def test_metadata_lists_fields_actions_context(admin_client):
    body = admin_client.get("/api/ai/metadata/").json()
    keys = {f["key"] for f in body["fields"]}
    assert {"customer_report", "diagnosis", "internal_notes"} <= keys
    assert any(a["key"] == "rewrite_faithful" for a in body["actions"])
    assert any(g["key"] == "diagnosis" for g in body["context_groups"])


def test_default_provider_is_openai(db):
    # O fixture autouse força anthropic; recriamos para checar o default do model.
    AISettings.objects.all().delete()
    conf = AISettings.get_solo()
    assert conf.provider == "openai"
    assert conf.model == "gpt-4o-mini"


def test_settings_get_and_edit_permission(admin_client, super_client):
    assert admin_client.get("/api/ai/settings/").status_code == 200
    # Administrador tem view mas NÃO edit (crítica).
    resp = admin_client.patch(
        "/api/ai/settings/", data={"model": "x"}, content_type="application/json"
    )
    assert resp.status_code == 403
    # Superuser edita e é auditado.
    resp = super_client.patch(
        "/api/ai/settings/",
        data={"model": "claude-opus-4-8", "max_tokens": 1500},
        content_type="application/json",
    )
    assert resp.status_code == 200
    assert resp.json()["max_tokens"] == 1500
    assert AuditLog.objects.filter(action="ai.settings.update").exists()


def test_settings_validates_ranges(super_client):
    resp = super_client.patch(
        "/api/ai/settings/", data={"temperature": 9}, content_type="application/json"
    )
    assert resp.status_code == 400


# --- instruções por campo ---


def test_field_instructions_list(admin_client):
    resp = admin_client.get("/api/ai/field-instructions/")
    assert resp.status_code == 200
    assert len(resp.json()) >= 12


def test_edit_field_requires_edit_permission(admin_client, super_client):
    tid = AIFieldInstruction.objects.get(field_key="diagnosis").id
    assert (
        admin_client.patch(
            f"/api/ai/field-instructions/{tid}/",
            data={"instruction": "nova"},
            content_type="application/json",
        ).status_code
        == 403
    )
    resp = super_client.patch(
        f"/api/ai/field-instructions/{tid}/",
        data={"instruction": "Nova instrução técnica."},
        content_type="application/json",
    )
    assert resp.status_code == 200
    assert resp.json()["is_customized"] is True


def test_edit_field_rejects_invalid_context_group(super_client):
    tid = AIFieldInstruction.objects.get(field_key="diagnosis").id
    resp = super_client.patch(
        f"/api/ai/field-instructions/{tid}/",
        data={"allowed_context": ["inexistente"]},
        content_type="application/json",
    )
    assert resp.status_code == 400


def test_restore_field_default(super_client):
    instr = AIFieldInstruction.objects.get(field_key="diagnosis")
    original = instr.instruction
    instr.instruction = "mexido"
    instr.is_customized = True
    instr.save()
    resp = super_client.post(f"/api/ai/field-instructions/{instr.id}/restore/")
    assert resp.status_code == 200
    instr.refresh_from_db()
    assert instr.instruction == original
    assert instr.is_customized is False


# --- geração ---


def test_generate_success(tecnico_client, work_order):
    with patch("apps.ai_assistant.services.get_provider") as gp:
        gp.return_value.generate.return_value = _mock_generate(
            "O cliente relatou um barulho."
        )
        resp = tecnico_client.post(
            GEN,
            data={
                "field": "customer_report",
                "action": "fix_grammar",
                "text": "carro faz barulho",
                "work_order": work_order.id,
            },
            content_type="application/json",
        )
    assert resp.status_code == 200
    assert resp.json()["suggestion"] == "O cliente relatou um barulho."
    log = AIUsageLog.objects.latest("created_at")
    assert log.status == "success"


def test_generate_requires_use_permission(estoque_client):
    resp = estoque_client.post(
        GEN,
        data={"field": "diagnosis", "action": "improve", "text": "x"},
        content_type="application/json",
    )
    assert resp.status_code == 403


def test_generate_blocks_disallowed_action_for_field(tecnico_client):
    # 'professional' exige can_rewrite, desabilitado no relato do cliente.
    resp = tecnico_client.post(
        GEN,
        data={"field": "customer_report", "action": "professional", "text": "abc"},
        content_type="application/json",
    )
    assert resp.status_code == 400


def test_generate_when_module_disabled(tecnico_client):
    conf = AISettings.get_solo()
    conf.is_active = False
    conf.save(update_fields=["is_active"])
    resp = tecnico_client.post(
        GEN,
        data={"field": "diagnosis", "action": "improve", "text": "x"},
        content_type="application/json",
    )
    assert resp.status_code == 409
    assert resp.json()["code"] == "ai_disabled"


def test_generate_provider_failure_preserves_text(tecnico_client):
    with patch("apps.ai_assistant.services.get_provider") as gp:
        gp.return_value.generate.side_effect = AIProviderError(
            "A configuração de IA está incompleta. Verifique o provedor e a chave de API.",
            code="config_incomplete",
        )
        resp = tecnico_client.post(
            GEN,
            data={"field": "diagnosis", "action": "improve", "text": "texto original"},
            content_type="application/json",
        )
    assert resp.status_code == 422
    body = resp.json()
    assert body["code"] == "config_incomplete"
    assert "suggestion" not in body  # texto original é preservado no frontend
    assert AIUsageLog.objects.latest("created_at").status == "failed"


def test_generate_validates_input(tecnico_client):
    resp = tecnico_client.post(
        GEN,
        data={"field": "diagnosis", "action": "improve", "text": "  "},
        content_type="application/json",
    )
    assert resp.status_code == 400


# --- teste de prompt / logs ---


def test_test_prompt_requires_test_permission(super_client, admin_client):
    with patch("apps.ai_assistant.services.get_provider") as gp:
        gp.return_value.generate.return_value = _mock_generate("Amostra.")
        resp = super_client.post(
            "/api/ai/test/",
            data={"field": "diagnosis", "action": "improve", "text": "exemplo"},
            content_type="application/json",
        )
    assert resp.status_code == 200
    assert resp.json()["suggestion"] == "Amostra."
    # Administrador não tem ai.test.
    assert (
        admin_client.post(
            "/api/ai/test/",
            data={"field": "diagnosis", "action": "improve", "text": "exemplo"},
            content_type="application/json",
        ).status_code
        == 403
    )


def test_logs_require_logs_permission(super_client, admin_client):
    assert super_client.get("/api/ai/logs/").status_code == 200
    assert admin_client.get("/api/ai/logs/").status_code == 403


def test_log_outcome_marks_applied(tecnico_client, super_client):
    with patch("apps.ai_assistant.services.get_provider") as gp:
        gp.return_value.generate.return_value = _mock_generate()
        tecnico_client.post(
            GEN,
            data={"field": "diagnosis", "action": "improve", "text": "x"},
            content_type="application/json",
        )
    log = AIUsageLog.objects.latest("created_at")
    resp = super_client.post(
        f"/api/ai/logs/{log.id}/outcome/",
        data={"applied": True},
        content_type="application/json",
    )
    assert resp.status_code == 200
    log.refresh_from_db()
    assert log.applied is True
