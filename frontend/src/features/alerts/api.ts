import { apiClient } from "@/lib/api-client";

import type {
  NotificationFilters,
  NotificationItem,
  NotificationPreference,
  NotificationRule,
} from "./types";

export async function listNotifications(
  filters: NotificationFilters = {},
): Promise<NotificationItem[]> {
  const params: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") params[key] = value;
  }
  const { data } = await apiClient.get<NotificationItem[]>("/notifications/", { params });
  return data;
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await apiClient.get<{ count: number }>("/notifications/unread-count/");
  return data.count;
}

export async function markRead(id: number): Promise<NotificationItem> {
  const { data } = await apiClient.post<NotificationItem>(`/notifications/${id}/read/`);
  return data;
}

export async function markUnread(id: number): Promise<NotificationItem> {
  const { data } = await apiClient.post<NotificationItem>(`/notifications/${id}/unread/`);
  return data;
}

export async function markAllRead(): Promise<{ updated: number }> {
  const { data } = await apiClient.post<{ updated: number }>("/notifications/mark-all-read/");
  return data;
}

export async function markReadBulk(ids: number[]): Promise<{ updated: number }> {
  const { data } = await apiClient.post<{ updated: number }>("/notifications/mark-read/", { ids });
  return data;
}

export async function archiveNotification(id: number): Promise<NotificationItem> {
  const { data } = await apiClient.post<NotificationItem>(`/notifications/${id}/archive/`);
  return data;
}

export interface ManualNotificationPayload {
  recipient_ids?: number[];
  role_key?: string;
  title: string;
  message: string;
  detail?: string;
  priority?: string;
  url?: string;
}

export async function sendManualNotification(
  payload: ManualNotificationPayload,
): Promise<{ created: number }> {
  const { data } = await apiClient.post<{ created: number }>("/notifications/manual/", payload);
  return data;
}

export async function getNotificationRules(): Promise<NotificationRule[]> {
  const { data } = await apiClient.get<NotificationRule[]>("/notification-rules/");
  return data;
}

type RuleChange = Partial<NotificationRule> & { notif_type: string };

export async function updateNotificationRules(
  changes: RuleChange | RuleChange[],
): Promise<NotificationRule[]> {
  const { data } = await apiClient.patch<NotificationRule[]>("/notification-rules/", changes);
  return data;
}

export async function getNotificationPreferences(): Promise<NotificationPreference> {
  const { data } = await apiClient.get<NotificationPreference>("/notification-preferences/");
  return data;
}

export async function updateNotificationPreferences(
  changes: Partial<NotificationPreference>,
): Promise<NotificationPreference> {
  const { data } = await apiClient.patch<NotificationPreference>(
    "/notification-preferences/",
    changes,
  );
  return data;
}
