import { apiClient } from "@/lib/api-client";

import type { Customer, CustomerPayload } from "./types";

export async function listCustomers(search?: string): Promise<Customer[]> {
  const { data } = await apiClient.get<Customer[]>("/customers/", {
    params: search ? { search } : undefined,
  });
  return data;
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
