"""Regressão: a mídia (uploads) é servida de forma PRIVADA e por OBJETO.

Antes, ``/media/`` era público. Depois passou a exigir só autenticação. Agora
exige a **permissão do módulo dono do arquivo** (orders/checkin/quotes) -- não
basta estar logado. O branding público (logo) segue aberto.
"""

import pytest

from apps.accounts.models import Permission, UserPermission

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def prod_media(settings):
    # Comportamento de prod: mídia via X-Accel-Redirect (não lê disco).
    settings.DEBUG = False


def _grant(user, code):
    perm = Permission.objects.get(codename=code)
    UserPermission.objects.create(
        user=user, permission=perm, grant_type=UserPermission.GrantType.GRANT
    )


def test_media_requires_authentication(client):
    resp = client.get("/media/orders/1/laudo.pdf")
    assert resp.status_code in (401, 403)


def test_authenticated_without_object_permission_is_denied(auth_client):
    # Usuário logado, mas SEM orders.view -> 403 (autorização por objeto).
    resp = auth_client.get("/media/orders/1/laudo.pdf")
    assert resp.status_code == 403


def test_authenticated_with_object_permission_gets_internal_redirect(auth_client, user):
    _grant(user, "orders.view")
    resp = auth_client.get("/media/orders/1/laudo.pdf")
    assert resp.status_code == 200
    assert resp["X-Accel-Redirect"] == "/internal-media/orders/1/laudo.pdf"


def test_object_permission_is_scoped_per_module(auth_client, user):
    # orders.view NÃO libera mídia de check-in nem de orçamento.
    _grant(user, "orders.view")
    assert auth_client.get("/media/checkin/1/photos/a.png").status_code == 403
    assert auth_client.get("/media/quotes/signed/doc.pdf").status_code == 403
    _grant(user, "checkin.view")
    assert auth_client.get("/media/checkin/1/photos/a.png").status_code == 200


def test_unknown_prefix_is_denied_by_default(auth_client, user):
    # Prefixo não mapeado -> fail-closed (mesmo com permissões).
    _grant(user, "orders.view")
    assert auth_client.get("/media/segredos/x.pdf").status_code == 403


def test_superuser_can_access_any_media(superuser_client):
    resp = superuser_client.get("/media/quotes/signed/contrato.pdf")
    assert resp.status_code == 200
    assert resp["X-Accel-Redirect"] == "/internal-media/quotes/signed/contrato.pdf"


def test_public_logo_is_accessible_without_auth(client):
    resp = client.get("/media/workshop/logos/logo.png")
    assert resp.status_code == 200
    assert resp["X-Accel-Redirect"] == "/internal-media/workshop/logos/logo.png"


def test_media_blocks_path_traversal(auth_client):
    resp = auth_client.get("/media/orders/..%2f..%2fetc/passwd")
    assert resp.status_code == 404
