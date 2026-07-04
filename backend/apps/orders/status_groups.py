"""Agrupamento dos status da OS para a visão operacional do Dashboard.

Reutilizado pela listagem de OS (filtro ``board=operational``) e pelos
indicadores do Dashboard. OS finalizadas e canceladas ficam de fora da visão
operacional por padrão.
"""

OPEN_STATUSES = ["open", "diagnosing", "awaiting_approval"]
IN_PROGRESS_STATUSES = [
    "approved",
    "in_progress",
    "awaiting_parts",
    "testing",
    "ready",
]
OPERATIONAL_STATUSES = OPEN_STATUSES + IN_PROGRESS_STATUSES
