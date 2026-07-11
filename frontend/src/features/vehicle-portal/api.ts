import { apiClient } from "@/lib/api-client";

import type { PortalMessageKind, VehiclePortal } from "./types";

export async function requestVehicleAccess(payload: {
  plate: string;
  email?: string;
  website?: string; // honeypot
}): Promise<{ detail: string }> {
  const { data } = await apiClient.post("/public/vehicle-access/request/", payload);
  return data;
}

export async function getVehiclePortal(token: string): Promise<VehiclePortal> {
  const { data } = await apiClient.get<VehiclePortal>(
    `/public/vehicle-access/${token}/`,
  );
  return data;
}

export async function sendPortalMessage(
  token: string,
  payload: { kind: PortalMessageKind; message: string; preferred_time?: string },
): Promise<{ detail: string }> {
  const { data } = await apiClient.post(
    `/public/vehicle-access/${token}/message/`,
    payload,
  );
  return data;
}

export function portalOrderPdfUrl(token: string, orderId: number): string {
  return `${apiClient.defaults.baseURL}/public/vehicle-access/${token}/order-pdf/${orderId}/`;
}
