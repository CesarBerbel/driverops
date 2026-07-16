import { apiClient } from "@/lib/api-client";
import { compressImage } from "@/lib/imageCompression";

import type { CheckIn, DamagePayload } from "./types";

/** Busca o check-in da OS; null quando ainda não iniciado (404). */
export async function getCheckIn(orderId: number): Promise<CheckIn | null> {
  try {
    const { data } = await apiClient.get<CheckIn>(`/work-orders/${orderId}/check-in/`);
    return data;
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response?.status;
    if (status === 404) return null;
    throw error;
  }
}

export async function startCheckIn(orderId: number): Promise<CheckIn> {
  const { data } = await apiClient.post<CheckIn>(`/work-orders/${orderId}/check-in/`);
  return data;
}

export async function updateCheckIn(id: number, payload: Partial<CheckIn>): Promise<CheckIn> {
  const { data } = await apiClient.patch<CheckIn>(`/check-ins/${id}/`, payload);
  return data;
}

export async function completeCheckIn(id: number, confirmEmpty = false): Promise<CheckIn> {
  const { data } = await apiClient.post<CheckIn>(`/check-ins/${id}/complete/`, {
    confirm_empty: confirmEmpty,
  });
  return data;
}

export async function reopenCheckIn(id: number): Promise<CheckIn> {
  const { data } = await apiClient.post<CheckIn>(`/check-ins/${id}/reopen/`);
  return data;
}

export async function setItems(
  id: number,
  items: { id: number; status: string; notes?: string }[],
): Promise<CheckIn> {
  const { data } = await apiClient.patch<CheckIn>(`/check-ins/${id}/items/`, { items });
  return data;
}

export async function addGeneralPhoto(
  id: number,
  file: File,
  category: string,
  caption = "",
): Promise<CheckIn> {
  const form = new FormData();
  form.append("file", await compressImage(file));
  form.append("category", category);
  form.append("caption", caption);
  const { data } = await apiClient.post<CheckIn>(`/check-ins/${id}/photos/`, form);
  return data;
}

export async function deleteGeneralPhoto(photoId: number): Promise<CheckIn> {
  const { data } = await apiClient.delete<CheckIn>(`/check-in-photos/${photoId}/`);
  return data;
}

export async function addBelonging(
  id: number,
  payload: { description: string; location?: string; notes?: string },
): Promise<CheckIn> {
  const { data } = await apiClient.post<CheckIn>(`/check-ins/${id}/belongings/`, payload);
  return data;
}

export async function deleteBelonging(belongingId: number): Promise<CheckIn> {
  const { data } = await apiClient.delete<CheckIn>(`/check-in-belongings/${belongingId}/`);
  return data;
}

export async function createDamage(payload: DamagePayload): Promise<CheckIn> {
  const { data } = await apiClient.post<CheckIn>(`/check-in-damages/`, payload);
  return data;
}

export async function updateDamage(damageId: number, payload: DamagePayload): Promise<CheckIn> {
  const { data } = await apiClient.patch<CheckIn>(`/check-in-damages/${damageId}/`, payload);
  return data;
}

export async function deleteDamage(damageId: number): Promise<CheckIn> {
  const { data } = await apiClient.delete<CheckIn>(`/check-in-damages/${damageId}/`);
  return data;
}

export async function addDamagePhoto(damageId: number, file: File): Promise<CheckIn> {
  const form = new FormData();
  form.append("file", await compressImage(file));
  const { data } = await apiClient.post<CheckIn>(`/check-in-damages/${damageId}/photos/`, form);
  return data;
}

export async function deleteDamagePhoto(photoId: number): Promise<CheckIn> {
  const { data } = await apiClient.delete<CheckIn>(`/check-in-damage-photos/${photoId}/`);
  return data;
}
