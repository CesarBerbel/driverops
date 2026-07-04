import { apiClient } from "@/lib/api-client";

import type { OrderActiveFilter, OrderStatus, WorkOrder, WorkOrderPayload } from "./types";

export type OrderPeriod = "today" | "week" | "month" | "last30" | "all";

export interface ListWorkOrdersParams {
  search?: string;
  active?: OrderActiveFilter;
  status?: OrderStatus;
  // Multiple workflow statuses in one request (Kanban visible columns).
  statuses?: OrderStatus[];
  overdue?: boolean;
  customer?: number;
  vehicle?: number;
  board?: "operational";
  period?: OrderPeriod;
}

export async function listWorkOrders(
  params: ListWorkOrdersParams = {},
): Promise<WorkOrder[]> {
  const { data } = await apiClient.get<WorkOrder[]>("/work-orders/", {
    params: {
      search: params.search || undefined,
      active: params.active,
      status:
        params.statuses && params.statuses.length > 0
          ? params.statuses.join(",")
          : params.status,
      overdue: params.overdue ? "true" : undefined,
      customer: params.customer,
      vehicle: params.vehicle,
      board: params.board,
      period: params.period,
    },
  });
  return data;
}

// Kanban drag-and-drop: change only the OS status. The backend validates the
// transition and returns the updated OS (400 on an invalid transition).
export async function moveWorkOrder(
  id: number,
  status: OrderStatus,
): Promise<WorkOrder> {
  const { data } = await apiClient.post<WorkOrder>(`/work-orders/${id}/move/`, {
    status,
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
