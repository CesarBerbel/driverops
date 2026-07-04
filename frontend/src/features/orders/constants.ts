import type { OrderDiscountType, OrderStatus } from "./types";

export const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "open", label: "Aberta" },
  { value: "diagnosing", label: "Em diagnóstico" },
  { value: "awaiting_approval", label: "Aguardando aprovação" },
  { value: "approved", label: "Aprovada" },
  { value: "in_progress", label: "Em execução" },
  { value: "awaiting_parts", label: "Aguardando peças" },
  { value: "testing", label: "Em teste" },
  { value: "ready", label: "Pronta para entrega" },
  { value: "finished", label: "Finalizada" },
  { value: "canceled", label: "Cancelada" },
];

export const DISCOUNT_TYPE_OPTIONS: { value: OrderDiscountType; label: string }[] = [
  { value: "none", label: "Nenhum" },
  { value: "percent", label: "Percentual" },
  { value: "fixed", label: "Valor fixo" },
];

// Special sentinels for the listing's single status dropdown, which mixes the
// workflow status with the soft-delete (disabled) view.
export const STATUS_FILTER_ALL = "all";
export const STATUS_FILTER_DISABLED = "disabled";

// Status groups for the Dashboard "OS" operational board. Finished/canceled are
// excluded from the board. Mirrors apps/orders/status_groups.py.
export const OPEN_STATUSES: OrderStatus[] = ["open", "diagnosing", "awaiting_approval"];
export const IN_PROGRESS_STATUSES: OrderStatus[] = [
  "approved",
  "in_progress",
  "awaiting_parts",
  "testing",
  "ready",
];

// Human label for a status. Falls back to the raw value if unknown.
export function statusLabel(status: OrderStatus): string {
  return ORDER_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

// Kanban drag-and-drop transition rules. MUST mirror
// backend/apps/orders/status_transitions.py -- the backend is the source of
// truth; these drive the drop-target highlighting and the "Mover" menu.
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  open: ["diagnosing", "awaiting_approval", "canceled"],
  diagnosing: ["awaiting_approval", "canceled"],
  awaiting_approval: ["approved", "canceled"],
  approved: ["in_progress", "canceled"],
  in_progress: ["awaiting_parts", "testing", "ready"],
  awaiting_parts: ["in_progress"],
  testing: ["ready", "in_progress"],
  ready: ["finished"],
  finished: [],
  canceled: [],
};

export function canTransition(current: OrderStatus, target: OrderStatus): boolean {
  if (current === target) return true;
  return ALLOWED_TRANSITIONS[current].includes(target);
}

export function allowedTargets(current: OrderStatus): OrderStatus[] {
  return ALLOWED_TRANSITIONS[current];
}
