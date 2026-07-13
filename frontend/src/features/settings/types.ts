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
  business_hours: string;
  notes: string;
  testimonials: WorkshopTestimonial[];
  updated_at: string;
}

export interface WorkshopTestimonial {
  name: string;
  service: string;
  rating: number;
  quote: string;
}

// The logo is uploaded/removed via a dedicated endpoint, not the profile PATCH.
export type WorkshopProfilePayload = Omit<WorkshopProfile, "updated_at" | "logo">;

export interface OrderSettings {
  default_delivery_days: number;
  default_payment_due_days: number;
  warranty_terms: string;
  quote_terms: string;
  service_authorization_terms: string;
  customer_acknowledgment_terms: string;
  default_os_notes: string;
  pdf_footer_text: string;
  print_instructions: string;
  general_conditions: string;
  pdf_client_copy_label: string;
  pdf_signature_label: string;
  notify_customer_by_email: boolean;
  notify_statuses: string[];
  notify_on_creation: boolean;
  notify_on_payment: boolean;
  // Políticas da máquina de estados da OS (regras de negócio configuráveis).
  require_diagnosis_before_approval: boolean;
  require_approved_quote_for_execution: boolean;
  require_checkin_before_execution: boolean;
  require_payment_to_finish: boolean;
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

// ---- Construtor de PDF da OS (layout por blocos) -------------------------

export type PdfOptionKind = "bool" | "text" | "textarea" | "number" | "select" | "multi";

// Especificação de uma opção de bloco (vem do catálogo do backend). O editor usa
// `kind` para escolher o controle e `default`/`choices`/`min`/`max` para o valor.
export interface PdfCatalogOption {
  key: string;
  kind: PdfOptionKind;
  label: string;
  default: unknown;
  choices?: [string, string][];
  min?: number;
  max?: number;
}

export interface PdfCatalogEntry {
  type: string;
  label: string;
  description: string;
  options: PdfCatalogOption[];
}

// Um bloco do documento: tipo + opções. `id` é uma chave estável local (para o
// editor); o backend a preserva mas não depende dela.
export interface PdfBlock {
  type: string;
  options: Record<string, unknown>;
  id?: string;
}

export interface PdfLayoutSettings {
  blocks: PdfBlock[];
  accent_color: string;
  base_font_size: number;
  catalog: PdfCatalogEntry[];
  updated_at: string;
}

export type PdfLayoutPayload = {
  blocks: PdfBlock[];
  accent_color: string;
  base_font_size: number;
};
