import { apiClient } from "@/lib/api-client";

import type { Part, PartPayload, PartStatusFilter } from "./types";

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
