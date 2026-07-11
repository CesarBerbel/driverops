import { apiClient } from "@/lib/api-client";
import { fetchPage, type Paginated } from "@/lib/pagination";

import type {
  Part,
  PartPayload,
  PartStatusFilter,
  StockMovement,
  StockMovementPayload,
} from "./types";

export interface ListPartsParams {
  search?: string;
  category?: number;
  status?: PartStatusFilter;
}

export async function listParts(params: ListPartsParams = {}): Promise<Part[]> {
  const { data } = await apiClient.get<Part[]>("/parts/", {
    params: {
      search: params.search || undefined,
      category: params.category,
      status: params.status,
    },
  });
  return data;
}

// Página real da listagem de peças (envelope {count,next,previous,results}).
export function listPartsPage(
  page: number,
  search?: string,
  status?: PartStatusFilter,
): Promise<Paginated<Part>> {
  return fetchPage<Part>("/parts/", page, { search, status });
}

export async function getPart(id: number): Promise<Part> {
  const { data } = await apiClient.get<Part>(`/parts/${id}/`);
  return data;
}

export async function createPart(payload: Partial<PartPayload>): Promise<Part> {
  const { data } = await apiClient.post<Part>("/parts/", payload);
  return data;
}

export async function updatePart(id: number, payload: Partial<PartPayload>): Promise<Part> {
  const { data } = await apiClient.patch<Part>(`/parts/${id}/`, payload);
  return data;
}

export async function deletePart(id: number): Promise<void> {
  await apiClient.delete(`/parts/${id}/`);
}

export async function reactivatePart(id: number): Promise<Part> {
  const { data } = await apiClient.post<Part>(`/parts/${id}/reactivate/`);
  return data;
}

export async function listStockMovements(partId: number): Promise<StockMovement[]> {
  const { data } = await apiClient.get<StockMovement[]>(`/parts/${partId}/movements/`);
  return data;
}

export async function createStockMovement(
  partId: number,
  payload: StockMovementPayload,
): Promise<StockMovement> {
  const { data } = await apiClient.post<StockMovement>(
    `/parts/${partId}/movements/`,
    payload,
  );
  return data;
}
