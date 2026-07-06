import { apiClient } from "@/lib/api-client";

import type {
  AttachmentCategory,
  OrderActiveFilter,
  OrderAttachment,
  OrderEvent,
  OrderEventType,
  OrderStatus,
  OrderStatusHistoryEntry,
  Technician,
  WorkOrder,
  WorkOrderPayload,
} from "./types";

// Origem do backend (baseURL sem o sufixo "/api"), para montar a URL absoluta
// dos anexos, cujo campo `file` vem como caminho relativo "/media/...".
const BACKEND_ORIGIN = (apiClient.defaults.baseURL ?? "").replace(/\/api\/?$/, "");

export function attachmentUrl(file: string): string {
  if (/^https?:\/\//.test(file)) return file;
  return `${BACKEND_ORIGIN}${file}`;
}

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
  technician?: number;
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
      technician: params.technician,
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

export async function listTechnicians(): Promise<Technician[]> {
  const { data } = await apiClient.get<Technician[]>("/work-orders/technicians/");
  return data;
}

export async function listStatusHistory(
  orderId: number,
): Promise<OrderStatusHistoryEntry[]> {
  const { data } = await apiClient.get<OrderStatusHistoryEntry[]>(
    `/work-orders/${orderId}/status-history/`,
  );
  return data;
}

export async function listAttachments(orderId: number): Promise<OrderAttachment[]> {
  const { data } = await apiClient.get<OrderAttachment[]>(
    `/work-orders/${orderId}/attachments/`,
  );
  return data;
}

export async function uploadAttachment(
  orderId: number,
  file: File,
  meta: { category?: AttachmentCategory; caption?: string } = {},
): Promise<OrderAttachment> {
  const form = new FormData();
  form.append("file", file);
  if (meta.category) form.append("category", meta.category);
  if (meta.caption) form.append("caption", meta.caption);
  const { data } = await apiClient.post<OrderAttachment>(
    `/work-orders/${orderId}/attachments/`,
    form,
  );
  return data;
}

export async function updateAttachment(
  orderId: number,
  attachmentId: number,
  payload: { category?: AttachmentCategory; caption?: string },
): Promise<OrderAttachment> {
  const { data } = await apiClient.patch<OrderAttachment>(
    `/work-orders/${orderId}/attachments/${attachmentId}/`,
    payload,
  );
  return data;
}

export async function deleteAttachment(
  orderId: number,
  attachmentId: number,
): Promise<void> {
  await apiClient.delete(`/work-orders/${orderId}/attachments/${attachmentId}/`);
}

export async function listOrderEvents(
  orderId: number,
  type?: OrderEventType,
): Promise<OrderEvent[]> {
  const { data } = await apiClient.get<OrderEvent[]>(
    `/work-orders/${orderId}/events/`,
    { params: { type } },
  );
  return data;
}
