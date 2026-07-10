"""Máquina de estados da Ordem de Serviço (OS).

Fonte **única** e central de toda a lógica de status da OS: quais transições
existem, de onde para onde, qual ação de negócio as representa, qual permissão
exigem, quais pré-condições validam, quando pedem justificativa e quais efeitos
colaterais disparam.

Princípio: o campo ``status`` NÃO é editável comum. Ele é consequência de uma
**ação** válida (``start_diagnosis``, ``approve``, ``finish``, ``cancel`` ...).
Toda mudança de status passa por :func:`transition`, dentro de transação com
``select_for_update`` (evita transições concorrentes conflitantes).

Regras críticas de segurança (transições válidas, permissões) vivem aqui e são
sempre protegidas. Regras de negócio flexíveis (exigir orçamento aprovado,
check-in, financeiro quitado) são configuráveis em ``OrderSettings`` — os
defaults preservam o comportamento atual (relaxado).
"""

from dataclasses import dataclass, field
from decimal import Decimal

from django.db import transaction

from apps.core.money import apply_discount, money

from .history import record_event, record_status_change
from .models import OrderEvent, OrderStatusHistory, WorkOrder

S = WorkOrder.Status

# Status terminais: só saem por reabertura formal (ação reopen, permissão especial).
TERMINAL_STATUSES = (S.FINISHED, S.CANCELED, S.REJECTED)
# Destinos válidos ao reabrir uma OS finalizada/cancelada.
REOPEN_TARGETS = (S.OPEN, S.DIAGNOSING, S.APPROVED, S.IN_PROGRESS)


class TransitionError(Exception):
    """Erro de negócio de uma transição, com mensagem amigável e código HTTP."""

    def __init__(self, message, *, code="invalid", http_status=400):
        self.message = message
        self.code = code
        self.http_status = http_status
        super().__init__(message)


@dataclass(frozen=True)
class Action:
    """Uma ação de transição da OS."""

    key: str
    label: str
    sources: tuple  # status de origem permitidos
    target: str | None  # status de destino (None => escolhido pelo chamador: reopen)
    permission: str = "kanban.move"  # operacional por padrão
    reason_required: bool = False
    notify_customer: bool = False
    critical: bool = False
    # Nome de um guard registrado em GUARDS (pré-condição de negócio).
    guards: tuple = field(default_factory=tuple)


# --- Catálogo central de ações -------------------------------------------------
# A ordem aqui é a ordem de exibição sugerida no frontend.
ACTIONS: dict[str, Action] = {
    "start_diagnosis": Action(
        "start_diagnosis", "Iniciar diagnóstico", (S.OPEN,), S.DIAGNOSING
    ),
    "send_to_approval": Action(
        "send_to_approval",
        "Enviar para aprovação",
        (S.OPEN, S.DIAGNOSING),
        S.AWAITING_APPROVAL,
        guards=("diagnosis_ready",),
    ),
    "approve": Action(
        "approve",
        "Aprovar",
        (S.AWAITING_APPROVAL,),
        S.APPROVED,
        guards=("approved_quote",),
    ),
    "reject": Action(
        "reject",
        "Recusar",
        (S.AWAITING_APPROVAL,),
        S.REJECTED,
        reason_required=True,
    ),
    "return_to_diagnosis": Action(
        "return_to_diagnosis",
        "Voltar para diagnóstico",
        (S.AWAITING_APPROVAL, S.REJECTED),
        S.DIAGNOSING,
    ),
    "start_execution": Action(
        "start_execution",
        "Iniciar execução",
        (S.APPROVED, S.AWAITING_PARTS),
        S.IN_PROGRESS,
        guards=("approved_quote_for_execution", "checkin_done"),
    ),
    "wait_for_parts": Action(
        "wait_for_parts",
        "Aguardar peças",
        (S.APPROVED, S.IN_PROGRESS),
        S.AWAITING_PARTS,
    ),
    "send_to_testing": Action(
        "send_to_testing", "Enviar para teste", (S.IN_PROGRESS,), S.TESTING
    ),
    "mark_ready": Action(
        "mark_ready",
        "Marcar como pronta",
        (S.IN_PROGRESS, S.TESTING),
        S.READY,
        notify_customer=True,
    ),
    "return_to_execution": Action(
        "return_to_execution",
        "Voltar para execução",
        (S.TESTING, S.READY),
        S.IN_PROGRESS,
    ),
    "finish": Action(
        "finish",
        "Finalizar",
        (S.READY,),
        S.FINISHED,
        permission="orders.finish",
        critical=True,
        notify_customer=True,
        guards=("financial_settled",),
    ),
    "cancel": Action(
        "cancel",
        "Cancelar",
        (
            S.OPEN,
            S.DIAGNOSING,
            S.AWAITING_APPROVAL,
            S.APPROVED,
            S.AWAITING_PARTS,
            S.IN_PROGRESS,
            S.TESTING,
            S.READY,
            S.REJECTED,
        ),
        S.CANCELED,
        permission="orders.cancel",
        critical=True,
        reason_required=True,
    ),
    "reopen": Action(
        "reopen",
        "Reabrir",
        (S.FINISHED, S.CANCELED, S.REJECTED),
        None,  # destino escolhido pelo chamador (REOPEN_TARGETS)
        permission="orders.reopen",
        critical=True,
        reason_required=True,
    ),
}

# Ação especial: força qualquer transição (destravamento administrativo).
FORCE_ACTION = "force_transition"


# --- Guards (pré-condições de negócio, configuráveis) --------------------------


def _order_settings():
    from apps.workshop.models import OrderSettings

    return OrderSettings.get_solo()


def _has_approved_quote(order) -> bool:
    return order.quotes.filter(
        is_active=True, status__in=["approved", "partially_approved"]
    ).exists()


def _has_items_or_diagnosis(order) -> bool:
    if (order.diagnosis or "").strip():
        return True
    return (
        order.service_items.exists()
        or order.package_items.exists()
        or order.part_items.exists()
    )


def _balance_due(order) -> Decimal:
    from .serializers import line_total

    gross = money(
        sum(
            (
                line_total(i)
                for i in list(order.service_items.all())
                + list(order.package_items.all())
                + list(order.part_items.all())
            ),
            Decimal("0"),
        )
    )
    final = money(
        gross - apply_discount(gross, order.discount_type, order.discount_value)
    )
    paid = money(sum((p.amount for p in order.payments.all()), Decimal("0")))
    balance = final - paid
    return balance if balance > 0 else Decimal("0")


def _guard_diagnosis_ready(order, conf):
    if conf.require_diagnosis_before_approval and not _has_items_or_diagnosis(order):
        return (
            "Preencha o diagnóstico ou gere um orçamento antes de enviar a OS "
            "para aprovação."
        )
    return None


def _guard_approved_quote(order, conf):
    if conf.require_approved_quote_for_execution and not _has_approved_quote(order):
        return "É preciso um orçamento aprovado (total ou parcial) para aprovar a OS."
    return None


def _guard_approved_quote_for_execution(order, conf):
    if conf.require_approved_quote_for_execution and not _has_approved_quote(order):
        return "Não é possível iniciar a execução sem um orçamento aprovado."
    return None


def _guard_checkin_done(order, conf):
    if not conf.require_checkin_before_execution:
        return None
    check_in = getattr(order, "check_in", None)
    if check_in is None or not check_in.is_locked:
        return "Conclua o check-in do veículo antes de iniciar a execução."
    return None


def _guard_financial_settled(order, conf):
    if conf.require_payment_to_finish and _balance_due(order) > 0:
        return "Quite o financeiro da OS antes de finalizar (há saldo em aberto)."
    return None


GUARDS = {
    "diagnosis_ready": _guard_diagnosis_ready,
    "approved_quote": _guard_approved_quote,
    "approved_quote_for_execution": _guard_approved_quote_for_execution,
    "checkin_done": _guard_checkin_done,
    "financial_settled": _guard_financial_settled,
}


# --- Permissões ---------------------------------------------------------------


def _has_perm(user, code) -> bool:
    return bool(
        user
        and getattr(user, "is_authenticated", False)
        and (user.is_superuser or user.has_perm_code(code))
    )


# --- Consultas ----------------------------------------------------------------


def _target_of(action: Action, order) -> str | None:
    return action.target


def _block_reason(order, action: Action) -> str | None:
    """Motivo de bloqueio (guards) ou None se a ação está liberada."""
    conf = _order_settings()
    for guard_key in action.guards:
        reason = GUARDS[guard_key](order, conf)
        if reason:
            return reason
    return None


def get_available_transitions(order, user) -> list[dict]:
    """Ações que o usuário pode ver a partir do status atual.

    Inclui ações bloqueadas por pré-condição (``available=False`` + motivo) e
    ações para as quais o usuário não tem permissão (``permitted=False``), para o
    frontend exibi-las **desabilitadas** -- deixando claro o que existe e por que
    está indisponível, em vez de simplesmente sumir com o botão. Só entram ações
    cuja origem casa com o status atual.
    """
    result = []
    for action in ACTIONS.values():
        if order.status not in action.sources:
            continue
        permitted = _has_perm(user, action.permission)
        block = _block_reason(order, action)
        entry = {
            "action": action.key,
            "label": action.label,
            "target_status": action.target,
            "target_status_display": (
                dict(S.choices).get(action.target) if action.target else None
            ),
            "permission": action.permission,
            "reason_required": action.reason_required,
            "critical": action.critical,
            "permitted": permitted,
            "available": block is None,
            "block_reason": block or "",
        }
        if action.key == "reopen":
            entry["reopen_targets"] = [
                {"value": t, "label": dict(S.choices)[t]} for t in REOPEN_TARGETS
            ]
        result.append(entry)
    return result


def resolve_action(current: str, target: str) -> str | None:
    """Descobre a ação que leva ``current`` -> ``target`` (usado pelo Kanban)."""
    for action in ACTIONS.values():
        if action.target == target and current in action.sources:
            return action.key
    return None


def can_transition(current: str, target: str) -> bool:
    """True se existe alguma ação levando ``current`` -> ``target``.

    Mover para o mesmo status é sempre válido (no-op de reordenação na coluna).
    Compatível com a assinatura antiga usada pelo Kanban.
    """
    if current == target:
        return True
    return resolve_action(current, target) is not None


def allowed_targets(current: str) -> list[str]:
    """Status de destino alcançáveis a partir de ``current`` (via alguma ação)."""
    targets = []
    for action in ACTIONS.values():
        if action.target and current in action.sources and action.target not in targets:
            targets.append(action.target)
    return targets


# --- Execução -----------------------------------------------------------------


def _run_side_effects(order, old_status, action, actor):
    """Efeitos colaterais controlados de uma transição (transacional)."""
    from .notifications import maybe_notify_status_change
    from .stock import deduct_stock_for_order

    # Baixa de estoque ao finalizar (idempotente via WorkOrder.stock_deducted).
    if order.status == S.FINISHED and old_status != S.FINISHED:
        deduct_stock_for_order(order, actor)
    # E-mail automático ao cliente nos marcos configurados (pronta/finalizada/...).
    maybe_notify_status_change(order, actor=actor)


def system_advance_to_approved(order, actor=None):
    """Avança a OS para 'Aprovada' como consequência da aprovação do orçamento.

    Chamado pelo fluxo de aprovação de orçamento (presencial/tablet/link público).
    É uma transição de **sistema** (origem = aprovação): não regride uma OS já
    além do início e passa pelo mesmo registro/efeitos das demais transições,
    corrigindo o bypass histórico que alterava o status sem rastro.
    """
    starters = (S.OPEN, S.DIAGNOSING, S.AWAITING_APPROVAL)
    if order.status not in starters:
        return order
    old_status = order.status
    order.status = S.APPROVED
    order.save(update_fields=["status", "updated_at"])
    labels = dict(S.choices)
    record_status_change(
        order,
        old_status,
        S.APPROVED,
        actor,
        action="approve",
        note="Orçamento aprovado pelo cliente",
        source=OrderStatusHistory.Source.APPROVAL,
    )
    record_event(
        order,
        OrderEvent.Type.STATUS_CHANGED,
        f"{labels.get(old_status, old_status)} → {labels[S.APPROVED]}",
        actor=actor,
    )
    _run_side_effects(order, old_status, ACTIONS["approve"], actor)
    return order


def validate_transition(order, action_key, user, *, reason="", target_status=None):
    """Valida (sem executar) uma transição. Levanta TransitionError se inválida."""
    if action_key == FORCE_ACTION:
        if not _has_perm(user, "orders.force_transition"):
            raise TransitionError(
                "Você não tem permissão para forçar transições de status.",
                code="forbidden",
                http_status=403,
            )
        if target_status not in dict(S.choices):
            raise TransitionError("Status de destino inválido.")
        if not (reason or "").strip():
            raise TransitionError("Informe a justificativa para forçar a transição.")
        return ACTIONS.get(action_key)

    action = ACTIONS.get(action_key)
    if action is None:
        raise TransitionError("Ação de transição desconhecida.")
    if order.status not in action.sources:
        raise TransitionError(
            f"Não é possível '{action.label}' a partir de "
            f"'{order.get_status_display()}'."
        )
    if not _has_perm(user, action.permission):
        raise TransitionError(
            "Você não tem permissão para esta ação.",
            code="forbidden",
            http_status=403,
        )
    if action.reason_required and not (reason or "").strip():
        raise TransitionError("Informe a justificativa para esta ação.")
    if action.key == "reopen" and target_status not in REOPEN_TARGETS:
        raise TransitionError("Escolha um status de destino válido para a reabertura.")
    block = _block_reason(order, action)
    if block:
        raise TransitionError(block, code="precondition")
    return action


def _resolve_target(action, action_key, target_status):
    if action_key == FORCE_ACTION or action.target is None:
        return target_status
    return action.target


def transition(
    order_id,
    action_key,
    user,
    *,
    reason="",
    notes="",
    target_status=None,
    source=OrderStatusHistory.Source.MANUAL,
    request=None,
):
    """Executa uma transição de status da OS de forma atômica e rastreável.

    Bloqueia a OS (``select_for_update``), revalida dentro da transação, aplica
    o novo status, grava histórico (ação/justificativa/origem), registra evento
    na timeline, dispara efeitos colaterais e auditoria. Se algo falhar, nada é
    persistido.
    """
    with transaction.atomic():
        try:
            order = WorkOrder.objects.select_for_update().get(
                pk=order_id, is_active=True
            )
        except WorkOrder.DoesNotExist as exc:
            raise TransitionError(
                "OS não encontrada.", code="not_found", http_status=404
            ) from exc

        action = validate_transition(
            order, action_key, user, reason=reason, target_status=target_status
        )
        target = _resolve_target(action, action_key, target_status)
        old_status = order.status
        if target == old_status:
            return order  # no-op

        order.status = target
        order.save(update_fields=["status", "updated_at"])

        labels = dict(S.choices)
        record_status_change(
            order,
            old_status,
            target,
            user,
            action=action_key,
            reason=reason,
            note=notes,
            source=source,
        )
        record_event(
            order,
            OrderEvent.Type.STATUS_CHANGED,
            f"{labels.get(old_status, old_status)} → {labels.get(target, target)}",
            actor=user,
        )
        _run_side_effects(order, old_status, action, user)

        if request is not None:
            from apps.accounts.audit import record_audit

            record_audit(
                request,
                f"orders.transition.{action_key}",
                new_value={
                    "order": order.id,
                    "from": old_status,
                    "to": target,
                    "reason": reason,
                },
            )
    return order
