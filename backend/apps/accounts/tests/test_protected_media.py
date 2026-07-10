"""Regressão: a mídia (uploads) é servida de forma PRIVADA.

Antes, ``/media/`` era público (servido direto pelo nginx). Agora exige
autenticação, exceto o branding público (logo da oficina).
"""

import pytest

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def prod_media(settings):
    # Comportamento de prod: mídia via X-Accel-Redirect (não lê disco).
    settings.DEBUG = False


def test_media_requires_authentication(client):
    resp = client.get("/media/orders/1/laudo.pdf")
    assert resp.status_code in (401, 403)


def test_authenticated_user_gets_internal_redirect(auth_client):
    resp = auth_client.get("/media/orders/1/laudo.pdf")
    assert resp.status_code == 200
    # Em prod o nginx serve pela location interna (não expõe /media/ direto).
    assert resp["X-Accel-Redirect"] == "/internal-media/orders/1/laudo.pdf"


def test_public_logo_is_accessible_without_auth(client):
    resp = client.get("/media/workshop/logos/logo.png")
    assert resp.status_code == 200
    assert resp["X-Accel-Redirect"] == "/internal-media/workshop/logos/logo.png"


def test_media_blocks_path_traversal(auth_client):
    resp = auth_client.get("/media/orders/..%2f..%2fetc/passwd")
    assert resp.status_code == 404
