export type NotificationChannel = "email" | "whatsapp" | "sms" | "internal";

export type NotificationContextKind = "order" | "quote" | "payment" | "manual";

export interface NotificationTemplate {
  id: number;
  event: string;
  event_display: string;
  channel: NotificationChannel;
  channel_display: string;
  context_kind: NotificationContextKind;
  name: string;
  description: string;
  subject: string;
  html_content: string;
  text_content: string;
  is_active: boolean;
  is_customized: boolean;
  updated_at: string;
  updated_by_name: string | null;
}

export type NotificationTemplatePayload = Partial<
  Pick<
    NotificationTemplate,
    "name" | "description" | "subject" | "html_content" | "text_content" | "is_active"
  >
>;

export interface TemplateVariable {
  key: string;
  label: string;
  example: string;
}

export interface VariableGroup {
  key: string;
  label: string;
  variables: TemplateVariable[];
}

export interface NotificationEventMeta {
  key: string;
  label: string;
  description: string;
  context: NotificationContextKind;
}

export interface NotificationChannelMeta {
  key: NotificationChannel;
  label: string;
}

export interface NotificationMetadata {
  events: NotificationEventMeta[];
  channels: NotificationChannelMeta[];
  variables: VariableGroup[];
}

export interface TemplatePreview {
  subject: string;
  html: string;
  text: string;
  errors: string[];
}

export interface TestSendResult {
  status: "sent" | "failed" | "skipped";
  recipient: string;
  error: string;
  link: string;
  errors: string[];
}

export interface TemplateHistoryEntry {
  action: string;
  actor: string | null;
  changed: string[];
  created_at: string;
}

export type ChannelFilter = NotificationChannel | "all";
export type StatusFilter = "all" | "active" | "inactive";
export type PreviewContext = "sample";
