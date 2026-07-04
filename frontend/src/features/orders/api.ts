import { apiClient } from "@/lib/api-client";

import type { OrderActiveFilter, OrderStatus, WorkOrder, WorkOrderPayload } from "./types";

export interface ListWorkOrdersParams {
  search?: string;
  active?: OrderActiveFilter;
  status?: OrderStatus;
  customer?: number;
  vehicle?: number;
}

export async function listWorkOrders(
  params: ListWorkOrdersParams = {},
): Promise<WorkOrder[]> {
  const { data } = await apiClient.get<WorkOrder[]>("/work-orders/", {
    params: {
      search: params.search || undefined,
      active: params.active,
      status: params.status,
      customer: params.customer,
      vehicle: params.vehicle,
    },
  });
  return data;
}

export async function getWorkOrder(id: number): Promise<WorkOrder> {
  const { data } = await apiClient.get<WorkOrder>(`/work-orders/${id}/`);
  return data;
}

export async function createWorkOrder(
  payload: Partial<WorkOrderPayload>,
): Promise<WorkOrder> {
  const { data } = await apiClient.post<WorkOrder>("/work-orders/", payload);
  return data;
}

export async function updateWorkOrder(
  id: number,
  payload: Partial<WorkOrderPayload>,
): Promise<WorkOrder> {
  const { data } = await apiClient.patch<WorkOrder>(`/work-orders/${id}/`, payload);
  return data;
}

export async function deleteWorkOrder(id: number): Promise<void> {
  await apiClient.delete(`/work-orders/${id}/`);
}

export async function reactivateWorkOrder(id: number): Promise<WorkOrder> {
  const { data } = await apiClient.post<WorkOrder>(`/work-orders/${id}/reactivate/`);
  return data;
}
