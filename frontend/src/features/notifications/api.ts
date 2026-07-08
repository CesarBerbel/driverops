import { apiClient } from "@/lib/api-client";

import type {
  ChannelFilter,
  NotificationMetadata,
  NotificationTemplate,
  NotificationTemplatePayload,
  StatusFilter,
  TemplateHistoryEntry,
  TemplatePreview,
  TestSendResult,
} from "./types";

interface ListParams {
  channel?: ChannelFilter;
  event?: string;
  status?: StatusFilter;
  q?: string;
}

export async function listNotificationTemplates(
  params: ListParams = {},
): Promise<NotificationTemplate[]> {
  const query: Record<string, string> = {};
  if (params.channel && params.channel !== "all") query.channel = params.channel;
  if (params.event) query.event = params.event;
  if (params.status && params.status !== "all") query.status = params.status;
  if (params.q) query.q = params.q;
  const { data } = await apiClient.get<NotificationTemplate[]>(
    "/notification-templates/",
    { params: query },
  );
  return data;
}

export async function getNotificationMetadata(): Promise<NotificationMetadata> {
  const { data } = await apiClient.get<NotificationMetadata>(
    "/notification-templates/metadata/",
  );
  return data;
}

export async function updateNotificationTemplate(
  id: number,
  payload: NotificationTemplatePayload,
): Promise<NotificationTemplate> {
  const { data } = await apiClient.patch<NotificationTemplate>(
    `/notification-templates/${id}/`,
    payload,
  );
  return data;
}

export async function restoreNotificationTemplate(
  id: number,
): Promise<NotificationTemplate> {
  const { data } = await apiClient.post<NotificationTemplate>(
    `/notification-templates/${id}/restore/`,
  );
  return data;
}

export async function previewNotificationTemplate(
  id: number,
): Promise<TemplatePreview> {
  const { data } = await apiClient.post<TemplatePreview>(
    `/notification-templates/${id}/preview/`,
    { context: "sample" },
  );
  return data;
}

export async function testSendNotificationTemplate(
  id: number,
  to: string,
): Promise<TestSendResult> {
  const { data } = await apiClient.post<TestSendResult>(
    `/notification-templates/${id}/test-send/`,
    { to, context: "sample" },
  );
  return data;
}

export async function getNotificationTemplateHistory(
  id: number,
): Promise<TemplateHistoryEntry[]> {
  const { data } = await apiClient.get<TemplateHistoryEntry[]>(
    `/notification-templates/${id}/history/`,
  );
  return data;
}

export async function bulkSetTemplateStatus(
  ids: number[],
  isActive: boolean,
): Promise<{ updated: number; is_active: boolean }> {
  const { data } = await apiClient.post<{ updated: number; is_active: boolean }>(
    "/notification-templates/bulk-status/",
    { ids, is_active: isActive },
  );
  return data;
}
