import type { WorkOrder } from "@/features/orders/types";

export type PaymentMethod =
  | "cash"
  | "pix"
  | "debit"
  | "credit"
  | "transfer"
  | "boleto"
  | "other";

export interface Payment {
  id: number;
  order: number;
  // DRF DecimalField -> JSON string.
  amount: string;
  method: PaymentMethod;
  method_display: string;
  paid_at: string;
  note: string;
  created_by_name: string | null;
  created_at: string;
}

export interface PaymentPayload {
  order: number;
  amount: string;
  method: PaymentMethod;
  paid_at: string;
  note?: string;
}

export interface ReceivablesResponse {
  count: number;
  total_receivable: string;
  results: WorkOrder[];
}

export interface ReportByMethod {
  method: PaymentMethod;
  method_display: string;
  total: string;
  count: number;
}

export interface ReportByDay {
  date: string;
  total: string;
}

export interface FinancialReport {
  total_received: string;
  payment_count: number;
  orders_count: number;
  average_ticket: string;
  by_method: ReportByMethod[];
  by_day: ReportByDay[];
}
