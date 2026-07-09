export type NotifStatus = "unread" | "read" | "archived";
export type NotifPriority = "info" | "attention" | "important" | "urgent" | "critical";

export interface NotificationItem {
  id: number;
  notif_type: string;
  notif_type_display: string;
  module: string;
  module_display: string;
  title: string;
  message: string;
  detail: string;
  priority: NotifPriority;
  priority_display: string;
  status: NotifStatus;
  status_display: string;
  is_read: boolean;
  related_type: string;
  related_id: number | null;
  url: string;
  action_label: string;
  data: Record<string, unknown>;
  origin: string;
  audience_role_name: string | null;
  created_at: string;
  read_at: string | null;
}

export interface NotificationRule {
  notif_type: string;
  notif_type_display: string;
  module: string;
  is_enabled: boolean;
  priority: NotifPriority;
  lead_time_hours: number;
  stall_days: number;
  recipient_roles: string[];
  show_in_bell: boolean;
  send_email: boolean;
  show_in_dashboard: boolean;
  group_similar: boolean;
  auto_expire_days: number;
  updated_at: string;
}

export interface NotificationPreference {
  muted_modules: string[];
  only_assigned: boolean;
  only_high_priority: boolean;
  mute_informational: boolean;
  sound_enabled: boolean;
  updated_at: string;
}

export interface NotificationFilters {
  status?: string;
  module?: string;
  priority?: string;
  notif_type?: string;
  q?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}
