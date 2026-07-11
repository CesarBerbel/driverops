import { apiClient } from "@/lib/api-client";
import { fetchPage, type Paginated } from "@/lib/pagination";

import type {
  DreReport,
  Expense,
  ExpensePayload,
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

export interface ListExpensesParams {
  period?: ReportPeriod;
  category?: string;
  search?: string;
}

export async function listExpenses(params: ListExpensesParams = {}): Promise<Expense[]> {
  const { data } = await apiClient.get<Expense[]>("/expenses/", {
    params: {
      period: params.period,
      category: params.category,
      search: params.search || undefined,
    },
  });
  return data;
}

// Página real da listagem de despesas (envelope {count,next,previous,results}).
export function listExpensesPage(
  page: number,
  params: ListExpensesParams = {},
): Promise<Paginated<Expense>> {
  return fetchPage<Expense>("/expenses/", page, {
    period: params.period,
    category: params.category,
    search: params.search || undefined,
  });
}

export async function createExpense(payload: ExpensePayload): Promise<Expense> {
  const { data } = await apiClient.post<Expense>("/expenses/", payload);
  return data;
}

export async function updateExpense(
  id: number,
  payload: ExpensePayload,
): Promise<Expense> {
  const { data } = await apiClient.patch<Expense>(`/expenses/${id}/`, payload);
  return data;
}

export async function deleteExpense(id: number): Promise<void> {
  await apiClient.delete(`/expenses/${id}/`);
}

export async function getDre(period: ReportPeriod): Promise<DreReport> {
  const { data } = await apiClient.get<DreReport>("/expenses/dre/", {
    params: { period },
  });
  return data;
}
