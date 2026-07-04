import pytest

from ..models import PackageService, Service, ServicePackage

pytestmark = pytest.mark.django_db


def _service(service_category, name, labor):
    return Service.objects.create(
        name=name, category=service_category, labor_cost=labor
    )


def test_list_requires_authentication(client):
    assert client.get("/api/service-packages/").status_code == 401


def test_create_with_services_computes_totals(auth_client, service_category):
    a = _service(service_category, "A", "200.00")
    b = _service(service_category, "B", "100.00")
    response = auth_client.post(
        "/api/service-packages/",
        data={"name": "Pacote", "items": [{"service": a.id}, {"service": b.id}]},
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.data["total_value"] == "300.00"
    assert response.data["final_value"] == "300.00"  # no discount
    assert response.data["items"][0]["service_name"] == "A"


def test_create_rejects_empty_services(auth_client):
    response = auth_client.post(
        "/api/service-packages/",
        data={"name": "Vazio", "items": []},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "items" in response.data


def test_create_rejects_missing_name(auth_client, service_category):
    a = _service(service_category, "A", "10.00")
    response = auth_client.post(
        "/api/service-packages/",
        data={"name": "   ", "items": [{"service": a.id}]},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "name" in response.data


def test_percent_discount(auth_client, service_category):
    a = _service(service_category, "A", "300.00")
    response = auth_client.post(
        "/api/service-packages/",
        data={
            "name": "Pacote",
            "discount_type": "percent",
            "discount_value": "10",
            "items": [{"service": a.id}],
        },
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.data["total_value"] == "300.00"
    assert response.data["final_value"] == "270.00"


def test_fixed_discount(auth_client, service_category):
    a = _service(service_category, "A", "300.00")
    response = auth_client.post(
        "/api/service-packages/",
        data={
            "name": "Pacote",
            "discount_type": "fixed",
            "discount_value": "50",
            "items": [{"service": a.id}],
        },
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.data["final_value"] == "250.00"


def test_percent_discount_out_of_range_rejected(auth_client, service_category):
    a = _service(service_category, "A", "300.00")
    response = auth_client.post(
        "/api/service-packages/",
        data={
            "name": "Pacote",
            "discount_type": "percent",
            "discount_value": "150",
            "items": [{"service": a.id}],
        },
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "discount_value" in response.data


def test_final_never_negative(auth_client, service_category):
    a = _service(service_category, "A", "100.00")
    response = auth_client.post(
        "/api/service-packages/",
        data={
            "name": "Pacote",
            "discount_type": "fixed",
            "discount_value": "500",
            "items": [{"service": a.id}],
        },
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.data["final_value"] == "0.00"


def test_rejects_duplicate_service(auth_client, service_category):
    a = _service(service_category, "A", "100.00")
    response = auth_client.post(
        "/api/service-packages/",
        data={"name": "Pacote", "items": [{"service": a.id}, {"service": a.id}]},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "items" in response.data


def test_create_rejects_inactive_service_as_new_link(auth_client, service_category):
    a = _service(service_category, "A", "100.00")
    a.is_active = False
    a.save(update_fields=["is_active"])
    response = auth_client.post(
        "/api/service-packages/",
        data={"name": "Pacote", "items": [{"service": a.id}]},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "items" in response.data


def test_update_keeps_existing_service_after_it_is_disabled(
    auth_client, service_category
):
    a = _service(service_category, "A", "100.00")
    package = ServicePackage.objects.create(name="Pacote")
    PackageService.objects.create(package=package, service=a)
    a.is_active = False
    a.save(update_fields=["is_active"])
    response = auth_client.patch(
        f"/api/service-packages/{package.id}/",
        data={"items": [{"service": a.id}]},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert len(response.data["items"]) == 1


def test_destroy_soft_deletes(auth_client, service_category):
    a = _service(service_category, "A", "100.00")
    package = ServicePackage.objects.create(name="Pacote")
    PackageService.objects.create(package=package, service=a)
    response = auth_client.delete(f"/api/service-packages/{package.id}/")
    assert response.status_code == 204
    package.refresh_from_db()
    assert package.is_active is False
    assert auth_client.get("/api/service-packages/").data == []


def test_reactivate(auth_client):
    package = ServicePackage.objects.create(name="Pacote", is_active=False)
    response = auth_client.post(f"/api/service-packages/{package.id}/reactivate/")
    assert response.status_code == 200
    package.refresh_from_db()
    assert package.is_active is True


def test_status_filters(auth_client):
    active = ServicePackage.objects.create(name="Ativo")
    inactive = ServicePackage.objects.create(name="Inativo", is_active=False)
    names = {p["name"] for p in auth_client.get("/api/service-packages/").data}
    assert active.name in names and inactive.name not in names
    names = {
        p["name"]
        for p in auth_client.get("/api/service-packages/?status=inactive").data
    }
    assert inactive.name in names and active.name not in names
