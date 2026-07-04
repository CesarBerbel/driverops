import { apiClient } from "@/lib/api-client";

import type {
  OrderSettings,
  OrderSettingsPayload,
  WorkshopProfile,
  WorkshopProfilePayload,
} from "./types";

export async function getWorkshopProfile(): Promise<WorkshopProfile> {
  const { data } = await apiClient.get<WorkshopProfile>("/workshop-profile/");
  return data;
}

export async function updateWorkshopProfile(
  payload: Partial<WorkshopProfilePayload>,
): Promise<WorkshopProfile> {
  const { data } = await apiClient.patch<WorkshopProfile>("/workshop-profile/", payload);
  return data;
}

export async function getOrderSettings(): Promise<OrderSettings> {
  const { data } = await apiClient.get<OrderSettings>("/order-settings/");
  return data;
}

export async function updateOrderSettings(
  payload: Partial<OrderSettingsPayload>,
): Promise<OrderSettings> {
  const { data } = await apiClient.patch<OrderSettings>("/order-settings/", payload);
  return data;
}
