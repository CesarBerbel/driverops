"""Smoke test da jornada principal (ponta a ponta, via HTTP).

Exercita o caminho crítico do sistema através da API real: login -> criar
cliente -> criar veículo -> abrir OS -> consultar -> mover status -> listar ->
logout. É a rede de segurança que pega uma quebra de integração entre os módulos
(auth, clientes, veículos, ordens) que os testes unitários de cada app não veem.
"""

import pytest
from django.contrib.auth import get_user_model
from django.test import Client

User = get_user_model()
pytestmark = pytest.mark.django_db


def _json(response):
    return response.json()


def test_full_service_order_journey():
    # Superusuário: o smoke test valida o FLUXO/integração, não o gating de
    # permissão (coberto à parte). Assim o caminho feliz fica direto e robusto.
    User.objects.create_superuser(
        email="smoke@example.com", password="StrongPass123", full_name="Smoke Tester"
    )
    client = Client()

    # 1) Login (autenticação por cookie JWT)
    login = client.post(
        "/api/auth/login/",
        data={"email": "smoke@example.com", "password": "StrongPass123"},
        content_type="application/json",
    )
    assert login.status_code == 200

    # 2) Criar cliente
    resp = client.post(
        "/api/customers/",
        data={"name": "João Silva", "phone": "11988887777"},
        content_type="application/json",
    )
    assert resp.status_code == 201, resp.content
    customer_id = _json(resp)["id"]

    # 3) Criar veículo do cliente
    resp = client.post(
        "/api/vehicles/",
        data={
            "customer": customer_id,
            "license_plate": "ABC1D23",
            "brand": "Honda",
            "model": "Civic",
        },
        content_type="application/json",
    )
    assert resp.status_code == 201, resp.content
    vehicle_id = _json(resp)["id"]

    # 4) Abrir OS
    resp = client.post(
        "/api/work-orders/",
        data={
            "customer": customer_id,
            "vehicle": vehicle_id,
            "opened_at": "2026-07-04",
            "customer_report": "luz de freio acesa mesmo com o carro desligado",
        },
        content_type="application/json",
    )
    assert resp.status_code == 201, resp.content
    order = _json(resp)
    order_id = order["id"]
    assert order["status"] == "open"
    assert order["number"] >= 1
    assert order["vehicle_plate"] == "ABC1D23"

    # 5) Consultar a OS criada
    resp = client.get(f"/api/work-orders/{order_id}/")
    assert resp.status_code == 200
    assert "luz de freio" in _json(resp)["customer_report"]

    # 6) Transições disponíveis a partir do status atual
    resp = client.get(f"/api/work-orders/{order_id}/transitions/")
    assert resp.status_code == 200

    # 7) Mover status: aberta -> em diagnóstico
    resp = client.post(
        f"/api/work-orders/{order_id}/move/",
        data={"status": "diagnosing"},
        content_type="application/json",
    )
    assert resp.status_code == 200, resp.content
    assert _json(resp)["status"] == "diagnosing"

    # 8) A OS aparece na listagem (lista simples ou envelope paginado)
    resp = client.get("/api/work-orders/")
    assert resp.status_code == 200
    body = _json(resp)
    results = body["results"] if isinstance(body, dict) and "results" in body else body
    assert any(row["id"] == order_id for row in results)

    # 9) Logout
    resp = client.post("/api/auth/logout/")
    assert resp.status_code in (200, 204, 205)


def test_journey_requires_authentication():
    # Sem login, o caminho crítico é barrado logo na primeira escrita.
    client = Client()
    resp = client.post(
        "/api/customers/",
        data={"name": "Anonimo"},
        content_type="application/json",
    )
    assert resp.status_code in (401, 403)
