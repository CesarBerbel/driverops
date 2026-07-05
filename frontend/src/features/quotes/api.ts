import { apiClient } from "@/lib/api-client";

import type { PublicQuote, Quote } from "./types";

// --- telas internas (autenticadas) ---

export async function listQuotes(workOrderId: number): Promise<Quote[]> {
  const { data } = await apiClient.get<Quote[]>("/quotes/", {
    params: { work_order: workOrderId },
  });
  return data;
}

export async function createQuote(
  workOrderId: number,
  validUntil?: string | null,
): Promise<Quote> {
  const { data } = await apiClient.post<Quote>("/quotes/", {
    work_order: workOrderId,
    valid_until: validUntil || null,
  });
  return data;
}

export async function sendQuote(id: number, email?: string): Promise<Quote> {
  const { data } = await apiClient.post<Quote>(`/quotes/${id}/send/`, { email });
  return data;
}

export async function approveQuotePhysical(
  id: number,
  payload: { client_name?: string; note?: string },
): Promise<Quote> {
  const { data } = await apiClient.post<Quote>(
    `/quotes/${id}/approve-physical/`,
    payload,
  );
  return data;
}

export async function approveQuoteTablet(
  id: number,
  payload: { client_name: string; signature: string },
): Promise<Quote> {
  const { data } = await apiClient.post<Quote>(
    `/quotes/${id}/approve-tablet/`,
    payload,
  );
  return data;
}

export async function rejectQuote(id: number, reason: string): Promise<Quote> {
  const { data } = await apiClient.post<Quote>(`/quotes/${id}/reject/`, { reason });
  return data;
}

export async function cancelQuote(id: number): Promise<Quote> {
  const { data } = await apiClient.post<Quote>(`/quotes/${id}/cancel/`);
  return data;
}

// Baixa o PDF via XHR (passa pelo interceptor de refresh) e abre em nova aba.
export async function openQuotePdf(id: number): Promise<void> {
  const response = await apiClient.get(`/quotes/${id}/pdf/`, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(response.data as Blob);
  window.open(url, "_blank", "noopener,noreferrer");
  // Libera o object URL depois de a aba ter tempo de carregá-lo.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// --- página pública de aprovação (sem autenticação, acesso pelo token) ---

export async function getPublicQuote(token: string): Promise<PublicQuote> {
  const { data } = await apiClient.get<PublicQuote>(`/public/quotes/${token}/`);
  return data;
}

export async function approvePublicQuote(
  token: string,
  payload: { client_name: string; terms_accepted: boolean },
): Promise<PublicQuote> {
  const { data } = await apiClient.post<PublicQuote>(
    `/public/quotes/${token}/approve/`,
    payload,
  );
  return data;
}

export async function rejectPublicQuote(
  token: string,
  payload: { client_name?: string; reason?: string },
): Promise<PublicQuote> {
  const { data } = await apiClient.post<PublicQuote>(
    `/public/quotes/${token}/reject/`,
    payload,
  );
  return data;
}
