"""Baixa automática de estoque ao finalizar a OS.

Só peças *cadastradas* (linha com `part`) dão baixa; peças avulsas não têm
saldo. A baixa é idempotente (controlada por WorkOrder.stock_deducted).
"""

import pytest

from apps.accounts.models import Permission, UserPermission
from apps.orders.models import WorkOrder, WorkOrderPart
from apps.orders.stock import deduct_stock_for_order
from apps.parts.models import StockMovement

pytestmark = pytest.mark.django_db


def _grant(user, codename):
    permission = Permission.objects.get(codename=codename)
    UserPermission.objects.update_or_create(
        user=user,
        permission=permission,
        defaults={"grant_type": UserPermission.GrantType.GRANT},
    )


def _order(customer, vehicle, status="ready"):
    return WorkOrder.objects.create(
        customer=customer,
        vehicle=vehicle,
        opened_at="2026-07-04",
        customer_report="Troca de peça",
        status=status,
    )


def _move(client, order, status):
    return client.post(
        f"/api/work-orders/{order.id}/move/",
        data={"status": status},
        content_type="application/json",
    )


def _transition(client, order, action, **body):
    return client.post(
        f"/api/work-orders/{order.id}/transition/",
        data={"action": action, **body},
        content_type="application/json",
    )


def test_finishing_deducts_registered_parts(auth_client, user, customer, vehicle, part):
    _grant(user, "orders.finish")
    order = _order(customer, vehicle, status="ready")
    WorkOrderPart.objects.create(order=order, part=part, quantity="2", unit_price="10")
    start = part.current_quantity

    response = _move(auth_client, order, "finished")
    assert response.status_code == 200

    part.refresh_from_db()
    assert part.current_quantity == start - 2
    movement = StockMovement.objects.get(part=part, order=order)
    assert movement.kind == StockMovement.Kind.OUT
    assert movement.quantity == 2
    assert movement.resulting_quantity == start - 2
    order.refresh_from_db()
    assert order.stock_deducted is True


def test_avulsa_parts_are_not_deducted(auth_client, user, customer, vehicle):
    _grant(user, "orders.finish")
    order = _order(customer, vehicle, status="ready")
    # Peça avulsa (part=None): sem saldo, nada a baixar.
    WorkOrderPart.objects.create(
        order=order, part=None, description="Parafuso avulso", quantity="5"
    )
    response = _move(auth_client, order, "finished")
    assert response.status_code == 200
    assert StockMovement.objects.filter(order=order).count() == 0
    order.refresh_from_db()
    assert order.stock_deducted is True


def test_same_part_in_multiple_lines_is_aggregated(
    auth_client, user, customer, vehicle, part
):
    _grant(user, "orders.finish")
    order = _order(customer, vehicle, status="ready")
    WorkOrderPart.objects.create(order=order, part=part, quantity="2")
    WorkOrderPart.objects.create(order=order, part=part, quantity="3")
    start = part.current_quantity

    _move(auth_client, order, "finished")

    part.refresh_from_db()
    assert part.current_quantity == start - 5
    # Uma única movimentação agregada por peça.
    assert StockMovement.objects.filter(part=part, order=order).count() == 1
    assert StockMovement.objects.get(part=part, order=order).quantity == 5


def test_deduction_is_idempotent(auth_client, customer, vehicle, part):
    order = _order(customer, vehicle, status="ready")
    WorkOrderPart.objects.create(order=order, part=part, quantity="2")
    start = part.current_quantity

    first = deduct_stock_for_order(order, None)
    second = deduct_stock_for_order(order, None)  # já baixada -> no-op

    assert len(first) == 1
    assert second == []
    part.refresh_from_db()
    assert part.current_quantity == start - 2
    assert StockMovement.objects.filter(order=order).count() == 1


def test_non_finish_transition_does_not_deduct(auth_client, customer, vehicle, part):
    order = _order(customer, vehicle, status="approved")
    WorkOrderPart.objects.create(order=order, part=part, quantity="2")
    start = part.current_quantity

    _move(auth_client, order, "in_progress")

    part.refresh_from_db()
    assert part.current_quantity == start
    assert StockMovement.objects.filter(order=order).count() == 0
    order.refresh_from_db()
    assert order.stock_deducted is False


def test_reopening_reverses_deduction(auth_client, user, customer, vehicle, part):
    """Reabrir uma OS finalizada devolve as peças ao estoque e limpa o flag."""
    _grant(user, "orders.finish")
    _grant(user, "orders.reopen")
    order = _order(customer, vehicle, status="ready")
    WorkOrderPart.objects.create(order=order, part=part, quantity="2")
    start = part.current_quantity

    _move(auth_client, order, "finished")
    part.refresh_from_db()
    assert part.current_quantity == start - 2

    resp = _transition(
        auth_client,
        order,
        "reopen",
        target_status="in_progress",
        reason="Cliente retornou com o mesmo problema.",
    )
    assert resp.status_code == 200

    part.refresh_from_db()
    assert part.current_quantity == start  # peça devolvida ao saldo
    order.refresh_from_db()
    assert order.stock_deducted is False
    reversal = StockMovement.objects.get(
        part=part, order=order, kind=StockMovement.Kind.IN
    )
    assert reversal.quantity == 2
    assert reversal.resulting_quantity == start


def test_reopen_add_part_and_refinalize_deducts_new_total(
    auth_client, user, customer, vehicle, part
):
    """Peça adicionada após a reabertura também dá baixa na re-finalização.

    Regressão: antes, o flag `stock_deducted` permanecia True ao reabrir, então a
    peça nova nunca saía do estoque.
    """
    _grant(user, "orders.finish")
    _grant(user, "orders.reopen")
    order = _order(customer, vehicle, status="ready")
    WorkOrderPart.objects.create(order=order, part=part, quantity="2")
    start = part.current_quantity

    _move(auth_client, order, "finished")  # baixa 2
    _transition(
        auth_client, order, "reopen", target_status="in_progress", reason="Faltou peça."
    )  # estorna 2 -> volta a `start`

    # A oficina lança mais 3 unidades da mesma peça e refinaliza.
    WorkOrderPart.objects.create(order=order, part=part, quantity="3")
    _move(auth_client, order, "ready")
    _move(auth_client, order, "finished")

    part.refresh_from_db()
    assert part.current_quantity == start - 5  # 2 originais + 3 novas
    order.refresh_from_db()
    assert order.stock_deducted is True
    # OUT(2), IN(2) estorno, OUT(5) re-finalização agregada.
    assert StockMovement.objects.filter(part=part, order=order).count() == 3


def test_reopen_remove_part_and_refinalize_returns_stock(
    auth_client, user, customer, vehicle, part
):
    """Peça removida após a reabertura volta ao estoque e não é rebaixada."""
    _grant(user, "orders.finish")
    _grant(user, "orders.reopen")
    order = _order(customer, vehicle, status="ready")
    line = WorkOrderPart.objects.create(order=order, part=part, quantity="2")
    start = part.current_quantity

    _move(auth_client, order, "finished")  # baixa 2
    _transition(
        auth_client,
        order,
        "reopen",
        target_status="in_progress",
        reason="Cliente recusou a peça.",
    )  # estorna 2
    line.delete()  # peça sai do orçamento
    _move(auth_client, order, "ready")
    _move(auth_client, order, "finished")

    part.refresh_from_db()
    assert part.current_quantity == start  # peça permaneceu no estoque
    # Sem terceira saída: só OUT(2) e IN(2) de estorno.
    assert (
        StockMovement.objects.filter(
            part=part, order=order, kind=StockMovement.Kind.OUT
        ).count()
        == 1
    )


def test_reverse_is_noop_when_not_deducted(customer, vehicle, part):
    """Estornar uma OS que nunca baixou não faz nada."""
    from apps.orders.stock import reverse_stock_for_order

    order = _order(customer, vehicle, status="in_progress")
    WorkOrderPart.objects.create(order=order, part=part, quantity="2")
    start = part.current_quantity

    assert reverse_stock_for_order(order, None) == []
    part.refresh_from_db()
    assert part.current_quantity == start
    assert StockMovement.objects.filter(order=order).count() == 0


def test_finishing_via_patch_is_rejected_and_does_not_deduct(
    auth_client, customer, vehicle, part
):
    order = _order(customer, vehicle, status="ready")
    WorkOrderPart.objects.create(order=order, part=part, quantity="2")
    start = part.current_quantity

    response = auth_client.patch(
        f"/api/work-orders/{order.id}/",
        data={"status": "finished"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "status" in response.json()

    part.refresh_from_db()
    assert part.current_quantity == start
    assert StockMovement.objects.filter(order=order).count() == 0
    order.refresh_from_db()
    assert order.status == "ready"
    assert order.stock_deducted is False
