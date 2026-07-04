import pytest
from django.utils import timezone

from apps.categories.models import Category
from apps.customers.models import Customer
from apps.orders.models import WorkOrder
from apps.parts.models import Part
from apps.services.models import Service, ServicePackage
from apps.vehicles.models import Vehicle

pytestmark = pytest.mark.django_db


def test_dashboard_stats_requires_authentication(client):
    assert client.get("/api/dashboard/stats/").status_code in (401, 403)


def test_dashboard_stats_counts(auth_client):
    today = timezone.localdate()
    c1 = Customer.objects.create(name="Cliente 1")
    Customer.objects.create(name="Cliente 2")
    vehicle = Vehicle.objects.create(customer=c1, license_plate="ABC1234")

    part_cat = Category.objects.create(category_type="part", name="Filtros")
    # A low-stock part (current <= min) and a healthy one.
    Part.objects.create(
        category=part_cat, name="Baixo", current_quantity=1, min_quantity=5
    )
    Part.objects.create(
        category=part_cat, name="Ok", current_quantity=10, min_quantity=5
    )

    svc_cat = Category.objects.create(category_type="service", name="Mecânica")
    service = Service.objects.create(name="Troca", category=svc_cat)
    ServicePackage.objects.create(name="Pacote")

    def make(status):
        WorkOrder.objects.create(
            customer=c1,
            vehicle=vehicle,
            opened_at=today,
            customer_report="x",
            status=status,
        )

    make("open")
    make("diagnosing")  # also "open" column
    make("in_progress")
    make("finished")
    make("canceled")

    data = auth_client.get("/api/dashboard/stats/").json()
    assert data["customers_total"] == 2
    assert data["vehicles_total"] == 1
    assert data["parts_total"] == 2
    assert data["parts_low_stock"] == 1
    assert data["services_total"] == 1
    assert data["packages_total"] == 1
    assert data["os_open"] == 2  # open + diagnosing
    assert data["os_in_progress"] == 1
    assert data["os_finished_period"] == 1
    # Values are decimal strings (labor/parts default to 0 here).
    assert data["os_open_value"] == "0.00"
    assert data["finished_value_period"] == "0.00"
    _ = service  # referenced for clarity


def test_dashboard_stats_period_scopes_finished(auth_client):
    c = Customer.objects.create(name="C")
    v = Vehicle.objects.create(customer=c, license_plate="XYZ1234")
    old = WorkOrder.objects.create(
        customer=c, vehicle=v, opened_at="2020-01-01", customer_report="x"
    )
    old.status = "finished"
    old.save()
    # Force the updated_at into the past so a "today" period excludes it.
    WorkOrder.objects.filter(pk=old.pk).update(
        updated_at=timezone.now() - timezone.timedelta(days=400)
    )

    today_stats = auth_client.get("/api/dashboard/stats/?period=today").json()
    assert today_stats["os_finished_period"] == 0

    all_stats = auth_client.get("/api/dashboard/stats/?period=all").json()
    assert all_stats["os_finished_period"] == 1
