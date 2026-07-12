import { apiClient } from "@/lib/api-client";

import type {
  RecentSearch,
  SavedSearch,
  SearchSuggestions,
  SmartSearchResponse,
  SmartSearchSettings,
} from "./types";

export async function smartSearch(query: string, limit?: number): Promise<SmartSearchResponse> {
  const { data } = await apiClient.post<SmartSearchResponse>("/search/smart/", {
    query,
    ...(limit ? { limit } : {}),
  });
  return data;
}

export async function getRecentSearches(): Promise<RecentSearch[]> {
  const { data } = await apiClient.get<RecentSearch[]>("/search/recent/");
  return data;
}

export async function clearRecentSearches(): Promise<void> {
  await apiClient.delete("/search/recent/");
}

export async function getSearchSuggestions(): Promise<SearchSuggestions> {
  const { data } = await apiClient.get<SearchSuggestions>("/search/suggestions/");
  return data;
}

export async function getSavedSearches(): Promise<SavedSearch[]> {
  const { data } = await apiClient.get<SavedSearch[]>("/search/saved/");
  return data;
}

export async function saveSearch(payload: { label: string; query: string }): Promise<SavedSearch> {
  const { data } = await apiClient.post<SavedSearch>("/search/saved/", payload);
  return data;
}

export async function deleteSavedSearch(id: number): Promise<void> {
  await apiClient.delete(`/search/saved/${id}/`);
}

export async function getSmartSearchSettings(): Promise<SmartSearchSettings> {
  const { data } = await apiClient.get<SmartSearchSettings>("/settings/smart-search/");
  return data;
}

export async function updateSmartSearchSettings(
  payload: Partial<SmartSearchSettings>,
): Promise<SmartSearchSettings> {
  const { data } = await apiClient.patch<SmartSearchSettings>(
    "/settings/smart-search/",
    payload,
  );
  return data;
}
