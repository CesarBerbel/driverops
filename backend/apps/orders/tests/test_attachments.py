"""Anexos da OS: upload (imagem/PDF), listagem, remoção e permissões."""

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client

from apps.accounts.models import Role
from apps.orders.models import OrderAttachment, WorkOrder

pytestmark = pytest.mark.django_db

User = get_user_model()


@pytest.fixture(autouse=True)
def media_root(tmp_path, settings):
    # Isola os uploads dos testes num diretório temporário.
    settings.MEDIA_ROOT = str(tmp_path)


@pytest.fixture
def order(db, customer, vehicle):
    return WorkOrder.objects.create(
        customer=customer, vehicle=vehicle, opened_at="2026-07-04", customer_report="x"
    )


def _png(name="foto.png"):
    # PNG REAL (decodificável) -- os uploads agora são re-codificados, então um
    # arquivo só com os magic bytes não passa mais.
    from io import BytesIO

    from PIL import Image

    buffer = BytesIO()
    Image.new("RGB", (4, 4), "red").save(buffer, format="PNG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/png")


def _client_for(email, password="StrongPass123"):
    c = Client()
    c.post(
        "/api/auth/login/",
        data={"email": email, "password": password},
        content_type="application/json",
    )
    return c


def test_upload_image_returns_201(auth_client, order):
    response = auth_client.post(
        f"/api/work-orders/{order.id}/attachments/", data={"file": _png()}
    )
    assert response.status_code == 201, response.json()
    body = response.json()
    assert body["original_name"] == "foto.png"
    assert body["is_image"] is True
    # Sem categoria informada -> "Outros".
    assert body["category"] == "other"
    assert OrderAttachment.objects.filter(order=order).count() == 1


def test_upload_with_category_and_caption(auth_client, order):
    response = auth_client.post(
        f"/api/work-orders/{order.id}/attachments/",
        data={
            "file": _png(),
            "category": "external_damage",
            "caption": "Risco na porta",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["category"] == "external_damage"
    assert body["category_display"] == "Avaria externa"
    assert body["caption"] == "Risco na porta"


def test_invalid_category_falls_back_to_other(auth_client, order):
    response = auth_client.post(
        f"/api/work-orders/{order.id}/attachments/",
        data={"file": _png(), "category": "banana"},
    )
    assert response.status_code == 201
    assert response.json()["category"] == "other"


def test_patch_updates_category_and_caption(auth_client, order):
    created = auth_client.post(
        f"/api/work-orders/{order.id}/attachments/", data={"file": _png()}
    ).json()
    response = auth_client.patch(
        f"/api/work-orders/{order.id}/attachments/{created['id']}/",
        data={"category": "engine", "caption": "Vazamento"},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.json()["category"] == "engine"
    assert response.json()["caption"] == "Vazamento"


def test_upload_pdf_is_allowed(auth_client, order):
    pdf = SimpleUploadedFile(
        "laudo.pdf", b"%PDF-1.4 fake", content_type="application/pdf"
    )
    response = auth_client.post(
        f"/api/work-orders/{order.id}/attachments/", data={"file": pdf}
    )
    assert response.status_code == 201
    assert response.json()["is_image"] is False


def test_disallowed_type_is_rejected(auth_client, order):
    txt = SimpleUploadedFile("nota.txt", b"hello", content_type="text/plain")
    response = auth_client.post(
        f"/api/work-orders/{order.id}/attachments/", data={"file": txt}
    )
    assert response.status_code == 400
    assert "file" in response.json()


def test_missing_file_is_rejected(auth_client, order):
    response = auth_client.post(f"/api/work-orders/{order.id}/attachments/", data={})
    assert response.status_code == 400


def test_disguised_file_is_rejected_by_magic_bytes(auth_client, order):
    # Nome .png e content_type de imagem, mas conteúdo arbitrário -> rejeitado.
    # A validação é por magic bytes, não pelo tipo declarado pelo cliente.
    evil = SimpleUploadedFile(
        "payload.png",
        b"<html><script>alert(1)</script></html>",
        content_type="image/png",
    )
    response = auth_client.post(
        f"/api/work-orders/{order.id}/attachments/", data={"file": evil}
    )
    assert response.status_code == 400


def test_upload_reencodes_image_and_derives_extension(auth_client, order):
    """A imagem é re-codificada (descarta bytes anexados) e a extensão vem do
    CONTEÚDO real, nunca do nome enviado pelo cliente."""
    from io import BytesIO

    from PIL import Image

    buffer = BytesIO()
    Image.new("RGB", (8, 8), "blue").save(buffer, format="PNG")
    # Conteúdo PNG + lixo anexado; nome e content_type MENTEM (.jpg / jpeg).
    payload = buffer.getvalue() + b"TRAILING-EVIL-BYTES" * 200
    disguised = SimpleUploadedFile("foto.jpg", payload, content_type="image/jpeg")

    resp = auth_client.post(
        f"/api/work-orders/{order.id}/attachments/", data={"file": disguised}
    )
    assert resp.status_code == 201
    att = OrderAttachment.objects.get(id=resp.json()["id"])
    # Extensão e content_type vêm do conteúdo (png), não do nome/CT enviados.
    assert att.file.name.endswith(".png")
    assert att.content_type == "image/png"
    # Re-codificado: o lixo anexado sumiu (arquivo bem menor que o payload).
    assert att.file.size < len(payload)
    # O nome original (só exibição) preserva o que o cliente mandou.
    assert att.original_name == "foto.jpg"


def test_list_attachments(auth_client, order):
    auth_client.post(
        f"/api/work-orders/{order.id}/attachments/", data={"file": _png("a.png")}
    )
    auth_client.post(
        f"/api/work-orders/{order.id}/attachments/", data={"file": _png("b.png")}
    )
    response = auth_client.get(f"/api/work-orders/{order.id}/attachments/")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_delete_attachment(auth_client, order):
    created = auth_client.post(
        f"/api/work-orders/{order.id}/attachments/", data={"file": _png()}
    ).json()
    response = auth_client.delete(
        f"/api/work-orders/{order.id}/attachments/{created['id']}/"
    )
    assert response.status_code == 204
    assert OrderAttachment.objects.filter(order=order).count() == 0


def test_upload_requires_authentication(client, order):
    response = client.post(
        f"/api/work-orders/{order.id}/attachments/", data={"file": _png()}
    )
    assert response.status_code in (401, 403)


def test_upload_requires_orders_edit(order):
    # Perfil Estoque: tem orders.view (pode listar), mas NÃO orders.edit.
    stock_user = User.objects.create_user(
        email="stock@example.com", password="StrongPass123", full_name="Estoquista"
    )
    stock_user.role = Role.objects.filter(key="estoque").first()
    stock_user.save(update_fields=["role"])
    client = _client_for(stock_user.email)

    # Consegue listar...
    assert client.get(f"/api/work-orders/{order.id}/attachments/").status_code == 200
    # ...mas não anexar.
    response = client.post(
        f"/api/work-orders/{order.id}/attachments/", data={"file": _png()}
    )
    assert response.status_code == 403
