import { apiClient } from "@/lib/api-client";

import type {
  Customer360,
  FinancialSummary,
  Interaction,
  OrderRow,
  QuoteRow,
  TimelineEvent,
} from "./types";

export async function getCustomer360(id: number): Promise<Customer360> {
  const { data } = await apiClient.get<Customer360>(`/customers/${id}/360/`);
  return data;
}

export async function getCustomerOrders(id: number): Promise<OrderRow[]> {
  const { data } = await apiClient.get<OrderRow[]>(`/customers/${id}/work-orders/`);
  return data;
}

export async function getCustomerQuotes(id: number): Promise<QuoteRow[]> {
  const { data } = await apiClient.get<QuoteRow[]>(`/customers/${id}/quotes/`);
  return data;
}

export async function getCustomerInteractions(id: number): Promise<Interaction[]> {
  const { data } = await apiClient.get<Interaction[]>(`/customers/${id}/interactions/`);
  return data;
}

export interface InteractionPayload {
  interaction_type: string;
  summary: string;
  content?: string;
  status?: string;
  next_action?: string;
  next_action_date?: string | null;
}

export async function createInteraction(
  id: number,
  payload: InteractionPayload,
): Promise<Interaction> {
  const { data } = await apiClient.post<Interaction>(`/customers/${id}/interactions/`, payload);
  return data;
}

export async function getCustomerFinancial(id: number): Promise<FinancialSummary> {
  const { data } = await apiClient.get<FinancialSummary>(`/customers/${id}/financial-summary/`);
  return data;
}

export async function getCustomerTimeline(id: number): Promise<TimelineEvent[]> {
  const { data } = await apiClient.get<TimelineEvent[]>(`/customers/${id}/timeline/`);
  return data;
}
