import type { DiscountType, ServiceStatusFilter } from "./types";

export const SERVICE_STATUS_OPTIONS: { value: ServiceStatusFilter; label: string }[] = [
  { value: "active", label: "Serviços habilitados" },
  { value: "inactive", label: "Serviços desabilitados" },
  { value: "all", label: "Todos" },
];

export const PACKAGE_STATUS_OPTIONS: { value: ServiceStatusFilter; label: string }[] = [
  { value: "active", label: "Pacotes habilitados" },
  { value: "inactive", label: "Pacotes desabilitados" },
  { value: "all", label: "Todos" },
];

export const DISCOUNT_TYPE_OPTIONS: { value: DiscountType; label: string }[] = [
  { value: "none", label: "Nenhum" },
  { value: "percent", label: "Percentual" },
  { value: "fixed", label: "Valor fixo" },
];
