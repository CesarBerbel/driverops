import { apiClient } from "@/lib/api-client";

import type {
  KanbanSettings,
  KanbanSettingsPayload,
  OrderSettings,
  OrderSettingsPayload,
  PdfLayoutPayload,
  PdfLayoutSettings,
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

export async function getPdfLayout(): Promise<PdfLayoutSettings> {
  const { data } = await apiClient.get<PdfLayoutSettings>("/pdf-layout/");
  return data;
}

export async function updatePdfLayout(
  payload: PdfLayoutPayload,
): Promise<PdfLayoutSettings> {
  const { data } = await apiClient.patch<PdfLayoutSettings>("/pdf-layout/", payload);
  return data;
}

// Pré-visualização: renderiza a OS mais recente com o layout enviado (sem salvar)
// e abre o PDF numa nova aba.
export async function previewPdfLayout(payload: PdfLayoutPayload): Promise<void> {
  const response = await apiClient.post("/pdf-layout/preview/", payload, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(response.data as Blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function getKanbanSettings(): Promise<KanbanSettings> {
  const { data } = await apiClient.get<KanbanSettings>("/kanban-settings/");
  return data;
}

export async function updateKanbanSettings(
  payload: KanbanSettingsPayload,
): Promise<KanbanSettings> {
  const { data } = await apiClient.patch<KanbanSettings>("/kanban-settings/", payload);
  return data;
}
