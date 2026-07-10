export type Priority = "low" | "medium" | "high" | "urgent";
export type Channel = "whatsapp" | "email" | "phone" | "none";
export type SuggestionStatus =
  | "new"
  | "in_analysis"
  | "scheduled"
  | "in_progress"
  | "sent"
  | "completed"
  | "ignored"
  | "snoozed"
  | "expired"
  | "canceled";

export interface SuggestionEvent {
  id: number;
  description: string;
  from_status: string;
  to_status: string;
  actor_name: string | null;
  created_at: string;
}

export interface Suggestion {
  id: number;
  suggestion_type: string;
  suggestion_type_display: string;
  category: string;
  category_display: string;
  priority: Priority;
  priority_display: string;
  status: SuggestionStatus;
  status_display: string;
  reason: string;
  recommended_action: string;
  suggested_text: string;
  channel: Channel;
  channel_display: string;
  due_date: string | null;
  snoozed_until: string | null;
  source: string;
  customer: number | null;
  customer_name: string | null;
  customer_phone: string;
  customer_whatsapp: string;
  customer_email: string;
  vehicle_plate: string;
  work_order: number | null;
  work_order_number: number | null;
  quote: number | null;
  quote_number: number | null;
  lead: number | null;
  assigned_to: number | null;
  assigned_to_name: string | null;
  events: SuggestionEvent[];
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type TaskStatus = "open" | "done" | "canceled";

export interface CrmTask {
  id: number;
  title: string;
  customer: number | null;
  customer_name: string | null;
  customer_phone: string;
  customer_whatsapp: string;
  vehicle: number | null;
  vehicle_plate: string;
  work_order: number | null;
  work_order_number: number | null;
  quote: number | null;
  quote_number: number | null;
  suggestion: number | null;
  assigned_to: number | null;
  assigned_to_name: string | null;
  due_date: string | null;
  priority: Priority;
  priority_display: string;
  status: TaskStatus;
  status_display: string;
  notes: string;
  created_at: string;
}

export interface TaskFilters {
  status?: string;
  open?: string;
  priority?: string;
  customer?: number;
  assigned_to?: number;
  q?: string;
}

export interface CreateTaskPayload {
  title: string;
  customer: number;
  priority?: Priority;
  due_date?: string | null;
  notes?: string;
}

export interface CrmSettings {
  is_active: boolean;
  tone: string;
  global_prompt: string;
  allow_ai_messages: boolean;
  use_os_data: boolean;
  use_financial_data: boolean;
  auto_send_messages: boolean;
  auto_create_tasks: boolean;
  seasonal_campaigns_enabled: boolean;
  daily_limit: number;
  lead_sla_hours: number;
  quote_followup_days: number;
  quote_expiring_days: number;
  rejected_recovery_days: number;
  os_ready_days: number;
  os_awaiting_days: number;
  os_stalled_days: number;
  post_service_days: number;
  preventive_months: number;
  inactive_months: number;
  holiday_lead_days: number;
  active_types: string[];
  custom_holidays: { date: string; name: string }[];
  updated_at: string;
}

export interface GenerateMessageResult {
  text: string;
  ai_used: boolean;
  reason?: string;
  error?: string;
  channel?: string;
}

export interface SuggestionFilters {
  status?: string;
  open?: string;
  priority?: string;
  category?: string;
  suggestion_type?: string;
  customer?: number;
  work_order?: number;
  q?: string;
}
