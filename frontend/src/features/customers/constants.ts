import type { CustomerType } from "./types";

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  individual: "Pessoa Física",
  company: "Pessoa Jurídica",
};

export const CUSTOMER_TYPE_OPTIONS: { value: CustomerType; label: string }[] = [
  { value: "individual", label: "Pessoa Física" },
  { value: "company", label: "Pessoa Jurídica" },
];
