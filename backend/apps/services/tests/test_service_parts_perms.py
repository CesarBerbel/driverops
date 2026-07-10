"""Permissão e auditoria de gerenciamento das peças padrão do serviço."""

import pytest

from apps.accounts.models import AuditLog, Permission, UserPermission
from apps.services.models import Service, ServicePart

pytestmark = pytest.mark.django_db


def _revoke(user, codename):
    perm = Permission.objects.get(codename=codename)
    UserPermission.objects.create(
        user=user, permission=perm, grant_type=UserPermission.GrantType.REVOKE
    )


def _payload(service_category, part, is_required=True):
    return {
        "name": "Troca de óleo",
        "category": service_category.id,
        "labor_cost": "100.00",
        "standard_parts": [
            {
                "part": part.id,
                "suggested_quantity": "1",
                "is_required": is_required,
                "notes": "",
            }
        ],
    }


def test_changing_parts_requires_manage_parts(
    auth_client, user, service_category, part
):
    _revoke(user, "services.manage_parts")
    resp = auth_client.post(
        "/api/services/",
        data=_payload(service_category, part),
        content_type="application/json",
    )
    assert resp.status_code == 403


def test_parts_change_with_permission_is_audited(auth_client, service_category, part):
    resp = auth_client.post(
        "/api/services/",
        data=_payload(service_category, part),
        content_type="application/json",
    )
    assert resp.status_code == 201
    assert AuditLog.objects.filter(action="services.parts.updated").exists()


def test_editing_service_without_touching_parts_is_allowed(
    auth_client, user, service_category, part
):
    # Serviço com uma peça padrão.
    service = Service.objects.create(
        name="Troca de óleo", category=service_category, labor_cost="100.00"
    )
    ServicePart.objects.create(service=service, part=part, is_required=True)
    _revoke(user, "services.manage_parts")

    # Edita só o nome (sem enviar standard_parts) -> permitido sem a permissão.
    resp = auth_client.patch(
        f"/api/services/{service.id}/",
        data={"name": "Troca de óleo premium"},
        content_type="application/json",
    )
    assert resp.status_code == 200

    # Reenvia as MESMAS peças (sem alteração) -> também permitido.
    resp2 = auth_client.patch(
        f"/api/services/{service.id}/",
        data={
            "standard_parts": [
                {
                    "part": part.id,
                    "suggested_quantity": "1",
                    "is_required": True,
                    "notes": "",
                }
            ]
        },
        content_type="application/json",
    )
    assert resp2.status_code == 200

    # Mas mudar a obrigatoriedade sem a permissão é bloqueado.
    resp3 = auth_client.patch(
        f"/api/services/{service.id}/",
        data={
            "standard_parts": [
                {
                    "part": part.id,
                    "suggested_quantity": "1",
                    "is_required": False,
                    "notes": "",
                }
            ]
        },
        content_type="application/json",
    )
    assert resp3.status_code == 403
