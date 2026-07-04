import type { SupplierStatusFilter, SupplierType } from "./types";

export const SUPPLIER_TYPE_OPTIONS: { value: SupplierType; label: string }[] = [
  { value: "individual", label: "Pessoa Física" },
  { value: "company", label: "Pessoa Jurídica" },
];

export const SUPPLIER_STATUS_OPTIONS: { value: SupplierStatusFilter; label: string }[] = [
  { value: "active", label: "Fornecedores habilitados" },
  { value: "inactive", label: "Fornecedores desabilitados" },
  { value: "all", label: "Todos" },
];
