import type { AttachmentCategory, OrderDiscountType, OrderStatus } from "./types";

export const ATTACHMENT_CATEGORY_OPTIONS: {
  value: AttachmentCategory;
  label: string;
}[] = [
  { value: "entry", label: "Entrada do veículo" },
  { value: "external_damage", label: "Avaria externa" },
  { value: "internal_damage", label: "Avaria interna" },
  { value: "engine", label: "Motor" },
  { value: "suspension", label: "Suspensão" },
  { value: "brakes", label: "Freios" },
  { value: "damaged_part", label: "Peça danificada" },
  { value: "in_progress", label: "Serviço em andamento" },
  { value: "completed", label: "Serviço concluído" },
  { value: "delivery", label: "Entrega do veículo" },
  { value: "other", label: "Outros" },
];

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
  { value: "rejected", label: "Recusada" },
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

// Kanban drag-and-drop transition rules. Espelho da máquina de estados do
// backend (apps/orders/state_machine.py -- fonte da verdade). Dirige apenas o
// realce dos alvos de drop e o menu "Mover"; a validação real (permissões,
// pré-condições, justificativa) é sempre do backend. Transições que exigem
// justificativa (cancelar/recusar) retornam 400 pedindo o motivo se arrastadas.
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  open: ["diagnosing", "awaiting_approval", "canceled"],
  diagnosing: ["awaiting_approval", "canceled"],
  awaiting_approval: ["approved", "rejected", "diagnosing", "canceled"],
  approved: ["in_progress", "awaiting_parts", "canceled"],
  in_progress: ["awaiting_parts", "testing", "ready", "canceled"],
  awaiting_parts: ["in_progress", "canceled"],
  testing: ["ready", "in_progress", "canceled"],
  ready: ["finished", "in_progress", "canceled"],
  finished: [],
  canceled: [],
  rejected: ["diagnosing", "canceled"],
};

export function canTransition(current: OrderStatus, target: OrderStatus): boolean {
  if (current === target) return true;
  return ALLOWED_TRANSITIONS[current].includes(target);
}

export function allowedTargets(current: OrderStatus): OrderStatus[] {
  return ALLOWED_TRANSITIONS[current];
}
