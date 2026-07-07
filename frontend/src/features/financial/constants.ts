import type { PaymentStatus } from "@/features/orders/types";

import type { ExpenseCategory, PaymentMethod } from "./types";

export const EXPENSE_CATEGORY_OPTIONS: { value: ExpenseCategory; label: string }[] = [
  { value: "suppliers", label: "Fornecedores/Peças" },
  { value: "salaries", label: "Salários/Mão de obra" },
  { value: "rent", label: "Aluguel" },
  { value: "utilities", label: "Água/Luz/Internet" },
  { value: "taxes", label: "Impostos/Taxas" },
  { value: "marketing", label: "Marketing" },
  { value: "maintenance", label: "Manutenção/Equipamentos" },
  { value: "other", label: "Outras" },
];

export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "pix", label: "Pix" },
  { value: "cash", label: "Dinheiro" },
  { value: "debit", label: "Cartão de débito" },
  { value: "credit", label: "Cartão de crédito" },
  { value: "transfer", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
  { value: "other", label: "Outro" },
];

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  open: "Em aberto",
  partial: "Parcial",
  paid: "Pago",
};

// Classes discretas por status (reaproveitam tokens existentes).
export const PAYMENT_STATUS_CLASS: Record<PaymentStatus, string> = {
  open: "bg-destructive/10 text-destructive",
  partial: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  paid: "bg-success/10 text-success",
};
