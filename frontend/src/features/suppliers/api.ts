import { apiClient } from "@/lib/api-client";

import type { Supplier, SupplierPayload, SupplierStatusFilter } from "./types";

export interface ListSuppliersParams {
  search?: string;
  status?: SupplierStatusFilter;
}

export async function listSuppliers(params: ListSuppliersParams = {}): Promise<Supplier[]> {
  const { data } = await apiClient.get<Supplier[]>("/suppliers/", {
    params: {
      search: params.search || undefined,
      status: params.status,
    },
  });
  return data;
}

export async function getSupplier(id: number): Promise<Supplier> {
  const { data } = await apiClient.get<Supplier>(`/suppliers/${id}/`);
  return data;
}

export async function createSupplier(payload: Partial<SupplierPayload>): Promise<Supplier> {
  const { data } = await apiClient.post<Supplier>("/suppliers/", payload);
  return data;
}

export async function updateSupplier(
  id: number,
  payload: Partial<SupplierPayload>,
): Promise<Supplier> {
  const { data } = await apiClient.patch<Supplier>(`/suppliers/${id}/`, payload);
  return data;
}

export async function deleteSupplier(id: number): Promise<void> {
  await apiClient.delete(`/suppliers/${id}/`);
}

export async function reactivateSupplier(id: number): Promise<Supplier> {
  const { data } = await apiClient.post<Supplier>(`/suppliers/${id}/reactivate/`);
  return data;
}
