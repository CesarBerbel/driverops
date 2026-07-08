import pytest

from apps.quotes.models import Quote

pytestmark = pytest.mark.django_db


def _create(auth_client, order):
    return auth_client.post(
        "/api/quotes/",
        data={"work_order": order.id},
        content_type="application/json",
    )


def test_blocks_second_open_quote_for_same_order(auth_client, work_order):
    first = _create(auth_client, work_order)
    assert first.status_code == 201  # rascunho (em aberto)

    second = _create(auth_client, work_order)
    assert second.status_code == 409
    assert "em aberto" in second.json()["detail"]
    # Nenhum orçamento extra foi criado.
    assert work_order.quotes.count() == 1


@pytest.mark.parametrize("open_status", ["draft", "sent", "viewed"])
def test_open_statuses_block_creation(auth_client, work_order, open_status):
    body = _create(auth_client, work_order).json()
    Quote.objects.filter(id=body["id"]).update(status=open_status)

    blocked = _create(auth_client, work_order)
    assert blocked.status_code == 409


@pytest.mark.parametrize(
    "terminal_status",
    ["approved", "partially_approved", "rejected", "canceled", "expired"],
)
def test_terminal_status_allows_new_version(auth_client, work_order, terminal_status):
    first = _create(auth_client, work_order).json()
    Quote.objects.filter(id=first["id"]).update(status=terminal_status)

    second = _create(auth_client, work_order)
    assert second.status_code == 201
    body = second.json()
    # Novo orçamento é uma nova versão; o anterior é preservado intacto.
    assert body["version"] == 2
    assert body["id"] != first["id"]
    preserved = Quote.objects.get(id=first["id"])
    assert preserved.status == terminal_status
    assert preserved.version == 1


def test_soft_deleted_open_quote_does_not_block(auth_client, work_order):
    first = _create(auth_client, work_order).json()
    # Cancelar via soft delete (DELETE) desativa o orçamento.
    auth_client.delete(f"/api/quotes/{first['id']}/")

    second = _create(auth_client, work_order)
    assert second.status_code == 201
