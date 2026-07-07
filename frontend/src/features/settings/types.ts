import type { OrderStatus } from "@/features/orders/types";

export interface WorkshopProfile {
  trade_name: string;
  legal_name: string;
  cnpj: string;
  state_registration: string;
  responsible: string;
  email: string;
  phone: string;
  whatsapp: string;
  website: string;
  logo: string | null;
  zip_code: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
  notes: string;
  updated_at: string;
}

// The logo is uploaded/removed via a dedicated endpoint, not the profile PATCH.
export type WorkshopProfilePayload = Omit<WorkshopProfile, "updated_at" | "logo">;

export interface OrderSettings {
  default_delivery_days: number;
  warranty_terms: string;
  quote_terms: string;
  service_authorization_terms: string;
  customer_acknowledgment_terms: string;
  default_os_notes: string;
  pdf_footer_text: string;
  print_instructions: string;
  general_conditions: string;
  notify_customer_by_email: boolean;
  notify_statuses: string[];
  notify_on_creation: boolean;
  notify_on_payment: boolean;
  updated_at: string;
}

export type OrderSettingsPayload = Omit<OrderSettings, "updated_at">;

// One Kanban column: an OS status plus whether it is shown. The list order is
// the column order on the board.
export interface KanbanColumnConfig {
  status: OrderStatus;
  visible: boolean;
}

export interface KanbanSettings {
  columns: KanbanColumnConfig[];
  updated_at: string;
}

export type KanbanSettingsPayload = { columns: KanbanColumnConfig[] };
