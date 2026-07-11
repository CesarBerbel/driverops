import { apiClient } from "@/lib/api-client";
import { fetchPage, type Paginated } from "@/lib/pagination";

import type { Customer, CustomerPayload } from "./types";

export type CustomerStatusFilter = "active" | "inactive";

export async function listCustomers(
  search?: string,
  status?: CustomerStatusFilter,
): Promise<Customer[]> {
  const params: Record<string, string> = {};
  if (search) params.search = search;
  if (status) params.status = status;
  const { data } = await apiClient.get<Customer[]>("/customers/", {
    params: Object.keys(params).length ? params : undefined,
  });
  return data;
}

// Página real da listagem de clientes (envelope {count,next,previous,results}).
export function listCustomersPage(
  page: number,
  search?: string,
  status?: CustomerStatusFilter,
): Promise<Paginated<Customer>> {
  return fetchPage<Customer>("/customers/", page, { search, status });
}

export async function getCustomer(id: number): Promise<Customer> {
  const { data } = await apiClient.get<Customer>(`/customers/${id}/`);
  return data;
}

export async function createCustomer(payload: Partial<CustomerPayload>): Promise<Customer> {
  const { data } = await apiClient.post<Customer>("/customers/", payload);
  return data;
}

export async function updateCustomer(
  id: number,
  payload: Partial<CustomerPayload>,
): Promise<Customer> {
  const { data } = await apiClient.patch<Customer>(`/customers/${id}/`, payload);
  return data;
}

export async function deleteCustomer(id: number): Promise<void> {
  await apiClient.delete(`/customers/${id}/`);
}

export async function reactivateCustomer(id: number): Promise<Customer> {
  const { data } = await apiClient.post<Customer>(`/customers/${id}/reactivate/`);
  return data;
}
