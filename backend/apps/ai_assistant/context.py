"""Montagem do contexto permitido da OS para a IA.

O contexto é **filtrado por campo**: apenas os grupos autorizados na configuração
do campo são incluídos. Isso implementa a regra de segurança "nunca enviar mais
contexto do que o necessário" e as restrições por campo (ex.: no relato do cliente
a IA não recebe diagnóstico/peças/serviços).
"""

from decimal import Decimal

from .fields import CONTEXT_GROUP_KEYS


def _plate(vehicle):
    return getattr(vehicle, "license_plate", "") or ""


def _join_items(items):
    return "; ".join((getattr(i, "description", "") or "") for i in items).strip("; ")


def _group_lines(order, group):
    """Devolve uma lista de linhas 'Rótulo: valor' para um grupo de contexto."""
    from apps.quotes.calc import format_brl

    customer = order.customer
    vehicle = order.vehicle

    if group == "customer":
        return [
            f"Cliente: {customer.name}",
            f"Tipo: {customer.get_customer_type_display()}",
        ]
    if group == "vehicle":
        year = vehicle.model_year or vehicle.manufacture_year
        return [
            f"Veículo: {vehicle.brand} {vehicle.model} {vehicle.version}".strip(),
            f"Placa: {_plate(vehicle)}",
            f"Ano: {year}" if year else "",
            f"Cor: {vehicle.color}" if vehicle.color else "",
            f"Quilometragem: {vehicle.mileage} km" if vehicle.mileage else "",
        ]
    if group == "order":
        return [
            f"OS nº: {order.number:04d}",
            f"Status: {order.get_status_display()}",
            f"Abertura: {order.opened_at}",
            (
                f"Previsão de entrega: {order.expected_delivery}"
                if order.expected_delivery
                else ""
            ),
        ]
    if group == "customer_report":
        return (
            [f"Relato do cliente: {order.customer_report}"]
            if order.customer_report
            else []
        )
    if group == "diagnosis":
        return [f"Diagnóstico: {order.diagnosis}"] if order.diagnosis else []
    if group == "internal_notes":
        return (
            [f"Observações internas: {order.internal_notes}"]
            if order.internal_notes
            else []
        )
    if group == "services":
        services = _join_items(
            list(order.service_items.all()) + list(order.package_items.all())
        )
        return [f"Serviços vinculados: {services}"] if services else []
    if group == "parts":
        parts = _join_items(order.part_items.all())
        return [f"Peças vinculadas: {parts}"] if parts else []
    if group == "quote":
        quote = order.quotes.order_by("-number").first()
        if quote is None:
            return []
        from apps.quotes.calc import compute_totals

        totals = compute_totals(quote)
        return [
            f"Orçamento nº: {quote.number:04d}",
            f"Status do orçamento: {quote.get_status_display()}",
            f"Valor total do orçamento: {format_brl(totals['total_quoted'])}",
            f"Valor aprovado: {format_brl(totals['total_approved'])}",
        ]
    if group == "financial":
        payments = list(order.payments.all())
        paid = sum((p.amount for p in payments), Decimal("0"))
        return [f"Valor pago: {format_brl(paid)}"] if payments else []
    if group == "history":
        rows = order.status_history.select_related().order_by("-changed_at")[:5]
        labels = [
            f"{r.changed_at:%d/%m/%Y}: {r.get_to_status_display() if hasattr(r, 'get_to_status_display') else r.to_status}"
            for r in rows
        ]
        return [f"Histórico recente: {'; '.join(labels)}"] if labels else []
    return []


def build_context_text(order, allowed_groups):
    """Texto de contexto (somente grupos permitidos). Vazio se nada aplicável."""
    if order is None or not allowed_groups:
        return ""
    groups = [g for g in allowed_groups if g in CONTEXT_GROUP_KEYS]
    lines = []
    for group in groups:
        for line in _group_lines(order, group):
            if line and line.strip():
                lines.append(f"- {line.strip()}")
    return "\n".join(lines)
