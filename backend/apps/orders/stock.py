"""Baixa automática de estoque ao finalizar uma Ordem de Serviço.

Quando uma OS entra no status "Finalizada", damos baixa das peças *cadastradas*
lançadas na OS (linhas com `part` preenchido; peças avulsas não têm saldo). Cada
baixa vira uma `StockMovement` de saída vinculada à OS, e o saldo da peça é
decrementado.

Regras:
- Idempotente: controlado por `WorkOrder.stock_deducted`. Finalizar de novo
  nunca dá baixa em dobro.
- A baixa reflete o consumo físico das peças, então o saldo *pode* ficar
  negativo (sinaliza que se usou mais do que o estoque registrado). Correções
  são feitas por um ajuste manual de estoque.
- Tudo em uma transação: ou todas as linhas dão baixa e a OS é marcada, ou nada.

Reabertura: quando uma OS finalizada é reaberta, `reverse_stock_for_order`
estorna a baixa (devolve as peças ao saldo) e limpa `stock_deducted`, de modo
que a re-finalização baixe do zero sobre as linhas atuais -- que podem ter sido
alteradas na reabertura. Sem isso, peças adicionadas/removidas após reabrir
ficariam fora do estoque. Ver `apps/orders/state_machine.py:_run_side_effects`.
"""

from collections import defaultdict

from django.db import transaction

from apps.parts.models import StockMovement


@transaction.atomic
def deduct_stock_for_order(order, user=None):
    """Dá baixa das peças cadastradas da OS. Devolve as movimentações criadas.

    Não faz nada (e devolve lista vazia) se a OS já teve baixa. O chamador é
    responsável por invocar isto apenas quando a OS passa a "Finalizada".
    """
    # Trava a linha da OS para evitar corrida entre duas finalizações simultâneas.
    locked = order.__class__.objects.select_for_update().get(pk=order.pk)
    if locked.stock_deducted:
        return []

    # Agrupa por peça: a mesma peça pode aparecer em várias linhas da OS.
    quantities = defaultdict(lambda: 0)
    parts_by_id = {}
    for item in locked.part_items.select_related("part").all():
        if item.part_id is None or item.quantity <= 0:
            continue
        quantities[item.part_id] += item.quantity
        parts_by_id[item.part_id] = item.part

    movements = []
    for part_id, total in quantities.items():
        part = parts_by_id[part_id]
        part.current_quantity = part.current_quantity - total
        part.save(update_fields=["current_quantity", "updated_at"])
        movements.append(
            StockMovement.objects.create(
                part=part,
                kind=StockMovement.Kind.OUT,
                quantity=total,
                resulting_quantity=part.current_quantity,
                reason=f"Baixa automática da OS #{locked.number}",
                order=locked,
                created_by=user if (user and user.is_authenticated) else None,
            )
        )

    locked.stock_deducted = True
    locked.save(update_fields=["stock_deducted", "updated_at"])
    order.stock_deducted = True
    return movements


@transaction.atomic
def reverse_stock_for_order(order, user=None):
    """Estorna a baixa de estoque quando uma OS finalizada é reaberta.

    Devolve ao saldo o líquido que a OS ainda tinha consumido (Σ saídas − Σ
    entradas de estorno já vinculadas a ela) com um movimento de entrada por
    peça, e limpa `stock_deducted`. Assim, uma posterior re-finalização volta a
    dar baixa do zero sobre as linhas atuais da OS (que podem ter mudado na
    reabertura). Devolve as movimentações criadas.

    Idempotente: não faz nada (devolve lista vazia) se a OS não tinha baixa. O
    chamador é responsável por invocar isto apenas quando a OS deixa de estar
    "Finalizada".
    """
    # Trava a linha da OS para evitar corrida entre reabertura e finalização.
    locked = order.__class__.objects.select_for_update().get(pk=order.pk)
    if not locked.stock_deducted:
        return []

    # Líquido ainda baixado por peça: saídas menos estornos anteriores desta OS.
    net = defaultdict(lambda: 0)
    parts_by_id = {}
    for mv in locked.stock_movements.select_related("part").all():
        if mv.kind == StockMovement.Kind.OUT:
            net[mv.part_id] += mv.quantity
        elif mv.kind == StockMovement.Kind.IN:
            net[mv.part_id] -= mv.quantity
        else:
            continue
        parts_by_id[mv.part_id] = mv.part

    movements = []
    for part_id, outstanding in net.items():
        if outstanding <= 0:
            continue
        part = parts_by_id[part_id]
        part.current_quantity = part.current_quantity + outstanding
        part.save(update_fields=["current_quantity", "updated_at"])
        movements.append(
            StockMovement.objects.create(
                part=part,
                kind=StockMovement.Kind.IN,
                quantity=outstanding,
                resulting_quantity=part.current_quantity,
                reason=f"Estorno da reabertura da OS #{locked.number}",
                order=locked,
                created_by=user if (user and user.is_authenticated) else None,
            )
        )

    locked.stock_deducted = False
    locked.save(update_fields=["stock_deducted", "updated_at"])
    order.stock_deducted = False
    return movements
