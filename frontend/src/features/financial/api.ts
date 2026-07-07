import { apiClient } from "@/lib/api-client";

import type {
  FinancialReport,
  Payment,
  PaymentPayload,
  ReceivablesResponse,
} from "./types";

export type ReportPeriod = "today" | "week" | "month" | "last30" | "all";

export async function listPayments(orderId: number): Promise<Payment[]> {
  const { data } = await apiClient.get<Payment[]>("/payments/", {
    params: { order: orderId },
  });
  return data;
}

export async function createPayment(payload: PaymentPayload): Promise<Payment> {
  const { data } = await apiClient.post<Payment>("/payments/", payload);
  return data;
}

export async function deletePayment(id: number): Promise<void> {
  await apiClient.delete(`/payments/${id}/`);
}

export interface ReceivablesParams {
  search?: string;
  status?: string;
}

export async function listReceivables(
  params: ReceivablesParams = {},
): Promise<ReceivablesResponse> {
  const { data } = await apiClient.get<ReceivablesResponse>(
    "/payments/receivables/",
    { params: { search: params.search || undefined, status: params.status } },
  );
  return data;
}

export async function getFinancialReport(
  period: ReportPeriod,
): Promise<FinancialReport> {
  const { data } = await apiClient.get<FinancialReport>("/payments/report/", {
    params: { period },
  });
  return data;
}
