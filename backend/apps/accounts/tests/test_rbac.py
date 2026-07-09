import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from django.test import Client

from apps.accounts.models import AuditLog, Permission, Role, UserPermission

User = get_user_model()
pytestmark = pytest.mark.django_db


def _client_for(email, password="StrongPass123"):
    """Cliente HTTP autenticado como o usuário informado (sessão isolada)."""
    c = Client()
    c.post(
        "/api/auth/login/",
        data={"email": email, "password": password},
        content_type="application/json",
    )
    return c


@pytest.fixture
def atendente_role(db):
    return Role.objects.get(key="atendente")


@pytest.fixture
def tecnico_role(db):
    return Role.objects.get(key="tecnico")


@pytest.fixture
def administrador_role(db):
    return Role.objects.get(key="administrador")


def test_administrador_manages_users_but_not_permissions(
    administrador_role, atendente_role
):
    User.objects.create_user(
        email="adm@example.com",
        password="StrongPass123",
        full_name="Admin Oficina",
        role=administrador_role,
    )
    c = _client_for("adm@example.com")
    # Pode CRIAR usuários.
    created = c.post(
        "/api/users/",
        data={
            "email": "novo@example.com",
            "full_name": "Novo",
            "role": atendente_role.id,
            "password": "StrongPass123",
        },
        content_type="application/json",
    )
    assert created.status_code == 201
    uid = created.json()["id"]
    # Pode DESATIVAR usuários.
    assert c.delete(f"/api/users/{uid}/").status_code == 204
    # NÃO pode editar permissões (permissions.manage é exclusivo do superuser).
    assert c.get(f"/api/users/{uid}/permissions/").status_code == 403
    assert (
        c.put(
            f"/api/users/{uid}/permissions/",
            data={"granted": [], "revoked": []},
            content_type="application/json",
        ).status_code
        == 403
    )
    assert c.get("/api/permissions/catalog/").status_code == 403


# --- catálogo semeado ---


def test_seed_created_permissions_and_roles():
    # 65 base + 3 notifications + 5 ai + 4 leads (view/attend/convert/config).
    assert Permission.objects.count() == 77
    assert set(Role.objects.values_list("key", flat=True)) == {
        "administrador",
        "atendente",
        "tecnico",
        "estoque",
        "financeiro",
    }
    assert Permission.objects.get(codename="permissions.manage").is_critical is True


# --- /users/me/ com RBAC ---


def test_me_superuser_has_all_permissions(superuser_client):
    body = superuser_client.get("/api/users/me/").json()
    assert body["is_superuser"] is True
    assert len(body["permissions"]) == Permission.objects.count()


def test_me_role_user_has_role_permissions(client, atendente_role):
    u = User.objects.create_user(
        email="at@example.com", password="StrongPass123", full_name="Ana"
    )
    u.role = atendente_role
    u.save()
    client.post(
        "/api/auth/login/",
        data={"email": u.email, "password": "StrongPass123"},
        content_type="application/json",
    )
    body = client.get("/api/users/me/").json()
    assert body["role"] == "atendente"
    assert "customers.create" in body["permissions"]
    assert "customers.delete" not in body["permissions"]


# --- gerenciamento de usuários (users.manage) ---


def test_users_list_requires_permission(user, superuser_client):
    # Usuário comum sem perfil -> sem users.manage (sessão própria).
    assert _client_for(user.email).get("/api/users/").status_code == 403
    assert superuser_client.get("/api/users/").status_code == 200


def test_superuser_creates_user(superuser_client, atendente_role):
    response = superuser_client.post(
        "/api/users/",
        data={
            "email": "Novo@Example.com",
            "full_name": "Novo Usuário",
            "role": atendente_role.id,
            "password": "StrongPass123",
        },
        content_type="application/json",
    )
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "novo@example.com"
    assert body["role_key"] == "atendente"
    assert body["is_superuser"] is False
    assert AuditLog.objects.filter(action="user.create").exists()


def test_create_requires_role(superuser_client):
    response = superuser_client.post(
        "/api/users/",
        data={"email": "x@example.com", "full_name": "X", "password": "StrongPass123"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "role" in response.json()


def test_duplicate_email_rejected(superuser_client, atendente_role, user):
    response = superuser_client.post(
        "/api/users/",
        data={
            "email": user.email.upper(),
            "full_name": "Dup",
            "role": atendente_role.id,
            "password": "StrongPass123",
        },
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "email" in response.json()


def test_specialty_only_for_tecnico(superuser_client, atendente_role, tecnico_role):
    bad = superuser_client.post(
        "/api/users/",
        data={
            "email": "a@example.com",
            "full_name": "A",
            "role": atendente_role.id,
            "technical_specialty": "mechanic",
            "password": "StrongPass123",
        },
        content_type="application/json",
    )
    assert bad.status_code == 400

    ok = superuser_client.post(
        "/api/users/",
        data={
            "email": "t@example.com",
            "full_name": "T",
            "role": tecnico_role.id,
            "technical_specialty": "mechanic",
            "password": "StrongPass123",
        },
        content_type="application/json",
    )
    assert ok.status_code == 201
    assert ok.json()["technical_specialty"] == "mechanic"


def test_send_invite_emails_reset_link(superuser_client, atendente_role):
    response = superuser_client.post(
        "/api/users/",
        data={
            "email": "invite@example.com",
            "full_name": "Convidado",
            "role": atendente_role.id,
            "send_invite": True,
        },
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.json()["force_password_change"] is True
    assert len(mail.outbox) == 1


def test_cannot_deactivate_self(superuser, superuser_client):
    response = superuser_client.delete(f"/api/users/{superuser.id}/")
    assert response.status_code == 400


def test_cannot_deactivate_last_superuser(superuser, superuser_client, atendente_role):
    # Cria outro admin para não cair no guard de "último administrativo".
    User.objects.create_user(
        email="adm2@example.com", password="x", full_name="Adm", role=atendente_role
    )
    other = User.objects.create_user(email="o@example.com", password="x", full_name="O")
    other.is_superuser = True
    other.save()
    # Desativa o outro superuser -> ok (ainda sobra 1). Depois o último -> bloqueado.
    assert superuser_client.delete(f"/api/users/{other.id}/").status_code == 204
    assert superuser_client.delete(f"/api/users/{superuser.id}/").status_code == 400


def test_deactivate_and_reactivate(superuser_client, atendente_role):
    uid = superuser_client.post(
        "/api/users/",
        data={
            "email": "d@example.com",
            "full_name": "D",
            "role": atendente_role.id,
            "password": "StrongPass123",
        },
        content_type="application/json",
    ).json()["id"]
    assert superuser_client.delete(f"/api/users/{uid}/").status_code == 204
    assert User.objects.get(pk=uid).is_active is False
    assert superuser_client.post(f"/api/users/{uid}/reactivate/").status_code == 200
    assert User.objects.get(pk=uid).is_active is True


def test_deactivated_user_cannot_login(superuser_client, atendente_role):
    uid = superuser_client.post(
        "/api/users/",
        data={
            "email": "gone@example.com",
            "full_name": "G",
            "role": atendente_role.id,
            "password": "StrongPass123",
        },
        content_type="application/json",
    ).json()["id"]
    superuser_client.delete(f"/api/users/{uid}/")
    from django.test import Client

    login = Client().post(
        "/api/auth/login/",
        data={"email": "gone@example.com", "password": "StrongPass123"},
        content_type="application/json",
    )
    assert login.status_code == 401


def test_reset_password_forces_change(superuser_client, atendente_role):
    uid = superuser_client.post(
        "/api/users/",
        data={
            "email": "r@example.com",
            "full_name": "R",
            "role": atendente_role.id,
            "password": "StrongPass123",
        },
        content_type="application/json",
    ).json()["id"]
    response = superuser_client.post(
        f"/api/users/{uid}/reset-password/",
        data={"password": "NewStrong123"},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert User.objects.get(pk=uid).force_password_change is True


# --- permissões (tela exclusiva do superuser) ---


def test_permissions_catalog_superuser_only(user, superuser_client):
    assert _client_for(user.email).get("/api/permissions/catalog/").status_code == 403
    body = superuser_client.get("/api/permissions/catalog/").json()
    assert any(m["module"] == "orders" for m in body["modules"])


def test_grant_and_revoke_user_permissions(superuser_client, atendente_role):
    uid = superuser_client.post(
        "/api/users/",
        data={
            "email": "p@example.com",
            "full_name": "P",
            "role": atendente_role.id,
            "password": "StrongPass123",
        },
        content_type="application/json",
    ).json()["id"]

    # Concede "orders.cancel" (extra) e remove "customers.create" (herdada).
    response = superuser_client.put(
        f"/api/users/{uid}/permissions/",
        data={"granted": ["orders.cancel"], "revoked": ["customers.create"]},
        content_type="application/json",
    )
    assert response.status_code == 200

    user = User.objects.get(pk=uid)
    effective = user.effective_permission_codes()
    assert "orders.cancel" in effective  # concedida
    assert "customers.create" not in effective  # removida apesar de herdada
    assert "customers.view" in effective  # herdada do perfil segue valendo

    # A tela reflete herdada vs concedida vs removida.
    detail = superuser_client.get(f"/api/users/{uid}/permissions/").json()
    flat = {p["codename"]: p for m in detail["modules"] for p in m["permissions"]}
    assert flat["orders.cancel"]["granted"] is True
    assert flat["customers.create"]["revoked"] is True
    assert flat["customers.view"]["inherited"] is True
    assert AuditLog.objects.filter(action="permission.set").exists()


def test_effective_permissions_model_logic(atendente_role):
    u = User.objects.create_user(
        email="m@example.com", password="x", full_name="M", role=atendente_role
    )
    base = u.effective_permission_codes()
    assert "customers.create" in base

    cancel = Permission.objects.get(codename="orders.cancel")
    UserPermission.objects.create(user=u, permission=cancel, grant_type="grant")
    create = Permission.objects.get(codename="customers.create")
    UserPermission.objects.create(user=u, permission=create, grant_type="revoke")

    effective = u.effective_permission_codes()
    assert "orders.cancel" in effective
    assert "customers.create" not in effective


# --- enforcement nos endpoints de domínio (backend bloqueia sem permissão) ---


def test_domain_module_permission_denies_and_allows(atendente_role):
    User.objects.create_user(
        email="atd@example.com",
        password="StrongPass123",
        full_name="Atendente",
        role=atendente_role,
    )
    c = _client_for("atd@example.com")
    # Atendente tem clientes (view), mas não tem peças/estoque.
    assert c.get("/api/customers/").status_code == 200
    assert c.get("/api/parts/").status_code == 403


def test_domain_action_permission_is_granular(tecnico_role):
    User.objects.create_user(
        email="tec@example.com",
        password="StrongPass123",
        full_name="Técnico",
        role=tecnico_role,
    )
    c = _client_for("tec@example.com")
    # Técnico vê OS (orders.view) mas não pode criar cliente (sem customers.create).
    assert c.get("/api/work-orders/").status_code == 200
    denied = c.post(
        "/api/customers/",
        data={"name": "Cliente X"},
        content_type="application/json",
    )
    assert denied.status_code == 403


def test_change_password_clears_force_flag(db):
    u = User.objects.create_user(
        email="fp@example.com", password="StrongPass123", full_name="FP"
    )
    u.force_password_change = True
    u.save()
    c = _client_for("fp@example.com")
    response = c.post(
        "/api/users/change-password/",
        data={
            "current_password": "StrongPass123",
            "new_password": "NewStrong456",
            "new_password_confirm": "NewStrong456",
        },
        content_type="application/json",
    )
    assert response.status_code == 204
    u.refresh_from_db()
    assert u.force_password_change is False


def test_audit_requires_permission(user, superuser_client):
    assert _client_for(user.email).get("/api/audit/").status_code == 403
    assert superuser_client.get("/api/audit/").status_code == 200
