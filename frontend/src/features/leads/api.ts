import { apiClient } from "@/lib/api-client";
import { fetchPage, type Paginated } from "@/lib/pagination";

import type {
  LeadDetail,
  LeadListItem,
  LeadPublicConfig,
  LeadRequestPayload,
  LeadSettings,
} from "./types";

// --- público ---

export async function getLeadPublicConfig(): Promise<LeadPublicConfig> {
  const { data } = await apiClient.get<LeadPublicConfig>("/public/lead-config/");
  return data;
}

export async function submitLeadRequest(
  payload: LeadRequestPayload,
): Promise<{ detail: string }> {
  const { data } = await apiClient.post<{ detail: string }>("/public/leads/", payload);
  return data;
}

// --- interno: inbox ---

interface LeadFilters {
  status?: string;
  assigned_to?: number;
  request_type?: string;
  q?: string;
}

// Página real do inbox (envelope {count,next,previous,results}). O backend
// entende `status=open` como "não terminais" (mesmos status do badge/pendências).
export function listLeadsPage(
  page: number,
  filters: LeadFilters = {},
): Promise<Paginated<LeadListItem>> {
  return fetchPage<LeadListItem>("/leads/", page, {
    status: filters.status,
    assigned_to: filters.assigned_to,
    request_type: filters.request_type,
    q: filters.q,
  });
}

export async function getLead(id: number): Promise<LeadDetail> {
  const { data } = await apiClient.get<LeadDetail>(`/leads/${id}/`);
  return data;
}

export async function getLeadsPendingCount(): Promise<number> {
  const { data } = await apiClient.get<{ count: number }>("/leads/pending-count/");
  return data.count;
}

function post(id: number, action: string, body?: unknown) {
  return apiClient.post<LeadDetail>(`/leads/${id}/${action}/`, body ?? {});
}

export const leadActions = {
  note: (id: number, text: string) => post(id, "note", { text }).then((r) => r.data),
  contact: (id: number, channel: string) => post(id, "contact", { channel }).then((r) => r.data),
  assign: (id: number, user: number | null) => post(id, "assign", { user }).then((r) => r.data),
  setStatus: (id: number, status: string) => post(id, "status", { status }).then((r) => r.data),
  markDuplicate: (id: number) => post(id, "mark-duplicate").then((r) => r.data),
  cancel: (id: number) => post(id, "cancel").then((r) => r.data),
  linkCustomer: (id: number, customer: number) =>
    post(id, "link-customer", { customer }).then((r) => r.data),
  createCustomer: (id: number) => post(id, "create-customer").then((r) => r.data),
  updateCustomer: (id: number) => post(id, "update-customer").then((r) => r.data),
  linkVehicle: (id: number, vehicle: number) =>
    post(id, "link-vehicle", { vehicle }).then((r) => r.data),
  createVehicle: (id: number) => post(id, "create-vehicle").then((r) => r.data),
  convertOs: (id: number, confirm = false) =>
    post(id, "convert-os", { confirm }).then((r) => r.data),
  convertQuote: (id: number, confirm = false) =>
    post(id, "convert-quote", { confirm }).then((r) => r.data),
};

// --- configurações ---

export async function getLeadSettings(): Promise<LeadSettings> {
  const { data } = await apiClient.get<LeadSettings>("/lead-settings/");
  return data;
}

export async function updateLeadSettings(
  payload: Partial<LeadSettings>,
): Promise<LeadSettings> {
  const { data } = await apiClient.patch<LeadSettings>("/lead-settings/", payload);
  return data;
}
