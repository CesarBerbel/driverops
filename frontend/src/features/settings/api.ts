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

export async function uploadWorkshopLogo(file: File): Promise<WorkshopProfile> {
  const formData = new FormData();
  formData.append("logo", file);
  const { data } = await apiClient.post<WorkshopProfile>(
    "/workshop-profile/logo/",
    formData,
  );
  return data;
}

export async function deleteWorkshopLogo(): Promise<WorkshopProfile> {
  const { data } = await apiClient.delete<WorkshopProfile>("/workshop-profile/logo/");
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
