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
