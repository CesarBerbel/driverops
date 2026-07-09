import { apiClient } from "@/lib/api-client";

import type {
  CrmSettings,
  GenerateMessageResult,
  Suggestion,
  SuggestionFilters,
} from "./types";

export async function listSuggestions(filters: SuggestionFilters = {}): Promise<Suggestion[]> {
  const params: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== "") params[k] = v;
  }
  const { data } = await apiClient.get<Suggestion[]>("/crm/suggestions/", { params });
  return data;
}

export async function getPendingCount(): Promise<number> {
  const { data } = await apiClient.get<{ count: number }>("/crm/suggestions/pending-count/");
  return data.count;
}

export async function updateSuggestion(id: number, payload: Partial<Suggestion>): Promise<Suggestion> {
  const { data } = await apiClient.patch<Suggestion>(`/crm/suggestions/${id}/`, payload);
  return data;
}

function action(name: string) {
  return async (id: number, body?: Record<string, unknown>): Promise<Suggestion> => {
    const { data } = await apiClient.post<Suggestion>(`/crm/suggestions/${id}/${name}/`, body ?? {});
    return data;
  };
}

export const approveSuggestion = action("approve");
export const dismissSuggestion = action("dismiss");
export const completeSuggestion = action("complete");
export const snoozeSuggestion = action("snooze");
export const markSent = action("mark-sent");

export async function generateMessage(id: number): Promise<GenerateMessageResult> {
  const { data } = await apiClient.post<GenerateMessageResult>(
    `/crm/suggestions/${id}/generate-message/`,
  );
  return data;
}

export async function toTask(id: number, title?: string): Promise<unknown> {
  const { data } = await apiClient.post(`/crm/suggestions/${id}/to-task/`, { title });
  return data;
}

export async function toCampaign(id: number, name?: string): Promise<unknown> {
  const { data } = await apiClient.post(`/crm/suggestions/${id}/to-campaign/`, { name });
  return data;
}

export async function getCrmSettings(): Promise<CrmSettings> {
  const { data } = await apiClient.get<CrmSettings>("/crm/settings/");
  return data;
}

export async function updateCrmSettings(payload: Partial<CrmSettings>): Promise<CrmSettings> {
  const { data } = await apiClient.patch<CrmSettings>("/crm/settings/", payload);
  return data;
}
