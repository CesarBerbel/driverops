"""Testes unitários do motor de renderização e validação."""

from apps.notifications.rendering import (
    extract_variables,
    html_to_text,
    render,
    unknown_variables,
    validate_template_fields,
)


def test_render_substitutes_known_variables():
    out = render("Olá, {{cliente.nome}}! OS {{ordem_servico.numero}}.", {
        "cliente.nome": "João",
        "ordem_servico.numero": "0042",
    })
    assert out == "Olá, João! OS 0042."


def test_render_missing_value_becomes_empty():
    assert render("[{{cliente.email}}]", {}) == "[]"


def test_render_tolerates_spaces_in_braces():
    assert render("{{ cliente.nome }}", {"cliente.nome": "Ana"}) == "Ana"


def test_extract_variables():
    found = extract_variables("{{cliente.nome}} e {{veiculo.placa}}")
    assert found == {"cliente.nome", "veiculo.placa"}


def test_unknown_variables_flags_invalid_keys():
    assert unknown_variables("{{cliente.nome}} {{cliente.inexistente}}") == [
        "cliente.inexistente"
    ]


def test_validate_rejects_unknown_variable():
    errors = validate_template_fields(
        channel="email",
        name="Teste",
        subject="Oi {{cliente.nome}}",
        html_content="<p>{{cliente.inexistente}}</p>",
        text_content="Oi",
    )
    assert any("inexistentes" in e for e in errors)


def test_validate_requires_subject_and_html_for_email():
    errors = validate_template_fields(
        channel="email", name="X", subject="", html_content="", text_content="",
    )
    assert any("assunto" in e for e in errors)
    assert any("HTML" in e for e in errors)
    assert any("texto puro" in e for e in errors)


def test_validate_requires_text_for_non_email():
    errors = validate_template_fields(
        channel="whatsapp", name="X", subject="", html_content="", text_content="",
    )
    assert any("conteúdo da mensagem" in e for e in errors)


def test_validate_rejects_malformed_html():
    errors = validate_template_fields(
        channel="email",
        name="X",
        subject="Assunto",
        html_content="<p>sem fechar",
        text_content="ok",
    )
    assert any("malformado" in e for e in errors)


def test_validate_rejects_dangling_braces():
    errors = validate_template_fields(
        channel="email",
        name="X",
        subject="Oi {{cliente.nome}",
        html_content="<p>ok</p>",
        text_content="ok",
    )
    assert any("mal formadas" in e for e in errors)


def test_validate_accepts_valid_template():
    errors = validate_template_fields(
        channel="email",
        name="Boas-vindas",
        subject="Olá {{cliente.primeiro_nome}}",
        html_content="<p>Olá, {{cliente.nome}}!</p>",
        text_content="Olá, {{cliente.nome}}!",
    )
    assert errors == []


def test_html_to_text_strips_tags_and_keeps_lines():
    text = html_to_text("<h1>Título</h1><p>Linha 1</p><p>Linha 2</p>")
    assert "Título" in text
    assert "Linha 1" in text
    assert "Linha 2" in text
    assert "<" not in text
