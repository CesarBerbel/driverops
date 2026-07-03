import { apiClient } from "@/lib/api-client";

import type { Vehicle, VehiclePayload, VehicleStatusFilter } from "./types";

export interface ListVehiclesParams {
  search?: string;
  customerId?: number;
  status?: VehicleStatusFilter;
}

export async function listVehicles(params: ListVehiclesParams = {}): Promise<Vehicle[]> {
  const { data } = await apiClient.get<Vehicle[]>("/vehicles/", {
    params: {
      search: params.search || undefined,
      customer: params.customerId,
      status: params.status,
    },
  });
  return data;
}

export async function getVehicle(id: number): Promise<Vehicle> {
  const { data } = await apiClient.get<Vehicle>(`/vehicles/${id}/`);
  return data;
}

export async function createVehicle(payload: Partial<VehiclePayload>): Promise<Vehicle> {
  const { data } = await apiClient.post<Vehicle>("/vehicles/", payload);
  return data;
}

export async function updateVehicle(
  id: number,
  payload: Partial<VehiclePayload>,
): Promise<Vehicle> {
  const { data } = await apiClient.patch<Vehicle>(`/vehicles/${id}/`, payload);
  return data;
}

export async function deleteVehicle(id: number): Promise<void> {
  await apiClient.delete(`/vehicles/${id}/`);
}

export async function reactivateVehicle(id: number): Promise<Vehicle> {
  const { data } = await apiClient.post<Vehicle>(`/vehicles/${id}/reactivate/`);
  return data;
}
