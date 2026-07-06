"""Movimentação de estoque: entrada/saída/ajuste, saldo e permissões críticas.

Convivência de vários usuários logados: cada um usa um `Client()` próprio
(logins compartilhando um mesmo client se sobrescrevem -- mesmo cuidado do
conftest de accounts).
"""

import pytest
from django.contrib.auth import get_user_model
from django.test import Client

from apps.accounts.models import Role
from apps.parts.models import Part, StockMovement

pytestmark = pytest.mark.django_db

User = get_user_model()


def _client_for(email, password="StrongPass123"):
    c = Client()
    c.post(
        "/api/auth/login/",
        data={"email": email, "password": password},
        content_type="application/json",
    )
    return c


@pytest.fixture
def part(db, part_category):
    return Part.objects.create(
        category=part_category,
        name="Filtro de óleo",
        current_quantity="10.00",
        sale_price="50.00",
    )


@pytest.fixture
def superuser(db):
    return User.objects.create_superuser(
        email="root@example.com", password="StrongPass123", full_name="Root"
    )


@pytest.fixture
def stock_user(db):
    """Perfil Estoque: tem parts.stock_move, mas NÃO parts.stock_adjust."""
    u = User.objects.create_user(
        email="stock@example.com", password="StrongPass123", full_name="Estoquista"
    )
    u.role = Role.objects.filter(key="estoque").first()
    u.save(update_fields=["role"])
    return u


def _post(client, part, kind, quantity, reason=""):
    return client.post(
        f"/api/parts/{part.id}/movements/",
        data={"kind": kind, "quantity": str(quantity), "reason": reason},
        content_type="application/json",
    )


def test_movements_require_authentication(client, part):
    assert client.get(f"/api/parts/{part.id}/movements/").status_code in (401, 403)
    assert _post(client, part, "in", "5").status_code in (401, 403)


def test_entrada_increases_balance(superuser, part):
    c = _client_for(superuser.email)
    response = _post(c, part, "in", "10", "compra")
    assert response.status_code == 201, response.json()
    body = response.json()
    assert body["resulting_quantity"] == "20.00"
    assert body["kind"] == "in"
    assert body["created_by_name"] == "Root"
    part.refresh_from_db()
    assert part.current_quantity == 20


def test_saida_decreases_balance(superuser, part):
    c = _client_for(superuser.email)
    assert _post(c, part, "out", "4").status_code == 201
    part.refresh_from_db()
    assert part.current_quantity == 6


def test_saida_beyond_balance_is_rejected(superuser, part):
    c = _client_for(superuser.email)
    response = _post(c, part, "out", "99")
    assert response.status_code == 400
    assert "quantity" in response.json()
    part.refresh_from_db()
    assert part.current_quantity == 10  # inalterado


def test_ajuste_sets_absolute_balance(superuser, part):
    c = _client_for(superuser.email)
    response = _post(c, part, "adjust", "5", "contagem")
    assert response.status_code == 201
    assert response.json()["resulting_quantity"] == "5.00"
    part.refresh_from_db()
    assert part.current_quantity == 5


def test_entrada_zero_quantity_is_rejected(superuser, part):
    c = _client_for(superuser.email)
    assert _post(c, part, "in", "0").status_code == 400


def test_negative_quantity_is_rejected(superuser, part):
    c = _client_for(superuser.email)
    assert _post(c, part, "in", "-3").status_code == 400


def test_extrato_lists_movements_newest_first(superuser, part):
    c = _client_for(superuser.email)
    _post(c, part, "in", "10")
    _post(c, part, "out", "3")
    response = c.get(f"/api/parts/{part.id}/movements/")
    assert response.status_code == 200
    rows = response.json()
    assert [r["kind"] for r in rows] == ["out", "in"]
    assert rows[0]["resulting_quantity"] == "17.00"


# --- permissões críticas ---


def test_admin_without_stock_move_is_forbidden(auth_client, part):
    # O fixture `user`/`auth_client` é Administrador: NÃO tem parts.stock_move.
    response = _post(auth_client, part, "in", "5")
    assert response.status_code == 403


def test_estoque_can_move_but_not_adjust(stock_user, part):
    c = _client_for(stock_user.email)
    assert _post(c, part, "in", "5").status_code == 201  # tem stock_move
    assert _post(c, part, "adjust", "1").status_code == 403  # não tem stock_adjust


def test_estoque_can_still_read_extrato(stock_user, part):
    c = _client_for(stock_user.email)
    assert c.get(f"/api/parts/{part.id}/movements/").status_code == 200


def test_movement_records_resulting_balance(superuser, part):
    c = _client_for(superuser.email)
    _post(c, part, "in", "10")  # 20
    _post(c, part, "adjust", "7")  # 7
    movements = list(StockMovement.objects.filter(part=part).order_by("id"))
    assert [m.resulting_quantity for m in movements] == [20, 7]
