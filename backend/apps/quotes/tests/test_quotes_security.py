"""Regressão: RBAC fail-closed + validação do upload da via assinada.

- ``upload_signed`` (antes não mapeada) era liberada a qualquer autenticado
  (fail-open) e aceitava qualquer arquivo. Agora exige ``quotes.approve`` e
  valida o conteúdo real.
"""

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.accounts.models import Permission, UserPermission
from apps.quotes.services import create_quote_from_order

pytestmark = pytest.mark.django_db

# PNG 1x1 válido (magic bytes corretos).
PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000a49444154789c6300010000050001"
    "0d0a2db40000000049454e44ae426082"
)


def _revoke(user, codename):
    perm = Permission.objects.get(codename=codename)
    UserPermission.objects.create(
        user=user, permission=perm, grant_type=UserPermission.GrantType.REVOKE
    )


def _upload(client, quote_id, content, name="signed.png"):
    return client.post(
        f"/api/quotes/{quote_id}/upload-signed/",
        data={"document": SimpleUploadedFile(name, content, content_type="image/png")},
    )


def test_upload_signed_requires_quotes_approve(auth_client, user, work_order):
    # Fail-closed: sem a permissão, a action agora é negada (antes era liberada).
    _revoke(user, "quotes.approve")
    quote = create_quote_from_order(work_order, user=user)
    resp = _upload(auth_client, quote.id, PNG)
    assert resp.status_code == 403


def test_upload_signed_rejects_disguised_file(auth_client, user, work_order):
    quote = create_quote_from_order(work_order, user=user)
    resp = _upload(auth_client, quote.id, b"<html>nao e imagem</html>")
    assert resp.status_code == 400


def test_upload_signed_accepts_valid_image(auth_client, user, work_order):
    quote = create_quote_from_order(work_order, user=user)
    resp = _upload(auth_client, quote.id, PNG)
    assert resp.status_code == 200
