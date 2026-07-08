"""Testes do serviço de dispatch e da resolução de templates."""

import pytest
from django.core import mail

from apps.notifications.models import NotificationLog, NotificationTemplate
from apps.notifications.services import (
    render_notification,
    resolve_template,
    send_notification,
)
from apps.notifications.variables import build_context, sample_context
from apps.orders.models import WorkOrder

pytestmark = pytest.mark.django_db


@pytest.fixture
def order(customer, vehicle):
    return WorkOrder.objects.create(
        customer=customer,
        vehicle=vehicle,
        opened_at="2026-07-04",
        customer_report="Barulho na frente",
        status="ready",
    )


def test_resolve_uses_active_custom_template():
    tpl = NotificationTemplate.objects.get(event="order_opened", channel="email")
    tpl.subject = "Custom {{ordem_servico.numero}}"
    tpl.is_active = True
    tpl.save()
    resolved, fields = resolve_template("order_opened", "email")
    assert resolved == tpl
    assert fields["subject"] == "Custom {{ordem_servico.numero}}"


def test_resolve_falls_back_to_default_when_inactive():
    tpl = NotificationTemplate.objects.get(event="order_opened", channel="email")
    tpl.is_active = False
    tpl.save(update_fields=["is_active"])
    resolved, fields = resolve_template("order_opened", "email")
    # Sem template ativo -> usa o padrão de fábrica (fallback seguro).
    assert resolved is None
    assert "{{oficina.nome}}" in fields["html_content"]


def test_render_with_real_context(order):
    context = build_context(work_order=order)
    result = render_notification("ready_for_pickup", "email", context)
    assert result.errors == []
    assert "Maria Silva".split(" ")[0] in result.html  # primeiro nome
    assert "0001" in result.subject  # número da OS formatado
    assert "ABC1D23" in result.html  # placa do veículo


def test_send_email_dispatches_and_logs(order):
    result = send_notification("order_opened", channel="email", work_order=order)
    assert result.ok
    assert result.recipient == "maria@example.com"
    assert len(mail.outbox) == 1
    # Multipart: HTML + texto puro (fallback).
    assert mail.outbox[0].alternatives  # HTML anexado
    log = NotificationLog.objects.latest("created_at")
    assert log.status == NotificationLog.Status.SENT
    assert log.channel == "email"


def test_send_skips_when_no_recipient(vehicle):
    from apps.customers.models import Customer

    no_email = Customer.objects.create(name="Sem Email")
    order = WorkOrder.objects.create(
        customer=no_email,
        vehicle=vehicle,
        opened_at="2026-07-04",
        customer_report="x",
    )
    result = send_notification("order_opened", channel="email", work_order=order)
    assert result.status == NotificationLog.Status.SKIPPED
    assert len(mail.outbox) == 0


def test_send_invalid_template_is_blocked(order):
    # Injeta uma variável inexistente direto no banco (contorna o serializer).
    tpl = NotificationTemplate.objects.get(event="order_opened", channel="email")
    tpl.html_content = "<p>{{cliente.inexistente}}</p>"
    tpl.save(update_fields=["html_content"])
    result = send_notification("order_opened", channel="email", work_order=order)
    assert result.status == NotificationLog.Status.FAILED
    assert result.errors
    assert len(mail.outbox) == 0


def test_whatsapp_test_returns_link(order):
    result = send_notification(
        "order_opened",
        channel="whatsapp",
        work_order=order,
        to="11987654321",
        is_test=True,
    )
    assert result.ok
    assert result.link.startswith("https://wa.me/55")


def test_sms_is_skipped_without_provider(order):
    result = send_notification(
        "order_opened", channel="sms", work_order=order, to="11987654321"
    )
    assert result.status == NotificationLog.Status.SKIPPED


def test_sample_context_covers_all_keys():
    from apps.notifications.variables import ALL_VARIABLE_KEYS

    ctx = sample_context()
    assert set(ctx) == set(ALL_VARIABLE_KEYS)
