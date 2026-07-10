"""Compatibilidade: regras de transição de status da OS.

A fonte única passou a ser :mod:`apps.orders.state_machine` (máquina de estados
formal, com ações, permissões, pré-condições e efeitos colaterais). Este módulo
apenas reexporta os helpers de transição para não quebrar imports existentes
(Kanban, listagens). Toda mudança de status deve passar por
``state_machine.transition``.
"""

from .state_machine import ACTIONS, allowed_targets, can_transition, resolve_action


def _allowed_map():
    """Mapa ``status -> [destinos]`` derivado das ações (para compatibilidade)."""
    result: dict[str, list[str]] = {}
    for action in ACTIONS.values():
        if not action.target:
            continue
        for src in action.sources:
            result.setdefault(src, [])
            if action.target not in result[src]:
                result[src].append(action.target)
    return result


ALLOWED_TRANSITIONS = _allowed_map()

__all__ = ["ALLOWED_TRANSITIONS", "allowed_targets", "can_transition", "resolve_action"]
