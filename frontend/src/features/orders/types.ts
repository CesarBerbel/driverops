export type OrderStatus =
  | "open"
  | "diagnosing"
  | "awaiting_approval"
  | "approved"
  | "in_progress"
  | "awaiting_parts"
  | "testing"
  | "ready"
  | "finished"
  | "canceled"
  | "rejected";

export type OrderDiscountType = "none" | "percent" | "fixed";

// Soft-delete dimension of the listing (separate from the workflow status).
export type OrderActiveFilter = "active" | "inactive" | "all";

// A line item as returned by the API. The FK (`service`/`package`/`part`) is
// null for avulso items. All money/quantity fields are DRF decimal strings.
export interface WorkOrderServiceItem {
  service: number | null;
  service_name?: string;
  description: string;
  display_name: string;
  quantity: string;
  unit_price: string;
  line_total: string;
  is_custom: boolean;
}

export interface WorkOrderPackageItem {
  package: number | null;
  package_name?: string;
  description: string;
  display_name: string;
  quantity: string;
  unit_price: string;
  line_total: string;
  is_custom: boolean;
}

export interface WorkOrderPartItem {
  part: number | null;
  part_name?: string;
  description: string;
  display_name: string;
  quantity: string;
  unit_price: string;
  line_total: string;
  is_custom: boolean;
  // Índice do serviço vinculado na lista de serviços da OS (ou null).
  linked_service_index: number | null;
  // Obrigatoriedade da peça em relação ao serviço vinculado.
  is_required: boolean;
}

export interface WorkOrder {
  id: number;
  number: number;
  customer: number;
  customer_name: string;
  customer_whatsapp: string;
  customer_phone: string;
  vehicle: number;
  vehicle_plate: string;
  vehicle_description: string;
  status: OrderStatus;
  status_display: string;
  assigned_technician: number | null;
  assigned_technician_name: string | null;
  opened_at: string;
  expected_delivery: string | null;
  current_mileage: number | null;
  customer_report: string;
  diagnosis: string;
  internal_notes: string;
  service_items: WorkOrderServiceItem[];
  package_items: WorkOrderPackageItem[];
  part_items: WorkOrderPartItem[];
  discount_type: OrderDiscountType;
  discount_value: string;
  services_total: string;
  packages_total: string;
  parts_total: string;
  gross_total: string;
  final_value: string;
  amount_paid: string;
  balance_due: string;
  payment_status: PaymentStatus;
  // Resumo do orçamento da OS (o orçamento é parte da OS). null quando a OS não
  // tem orçamento ativo.
  quote_status: string | null;
  quote_status_display: string | null;
  created_at: string;
  updated_at: string;
}

export type PaymentStatus = "open" | "partial" | "paid";

export interface WorkOrderLinePayload {
  description: string;
  quantity: string;
  unit_price: string;
}

export interface WorkOrderPayload {
  customer: number;
  vehicle: number;
  status: OrderStatus;
  assigned_technician: number | null;
  opened_at: string;
  expected_delivery: string | null;
  current_mileage: number | null;
  customer_report: string;
  diagnosis: string;
  internal_notes: string;
  discount_type: OrderDiscountType;
  discount_value: string;
  service_items: (WorkOrderLinePayload & { service: number | null })[];
  package_items: (WorkOrderLinePayload & { package: number | null })[];
  part_items: (WorkOrderLinePayload & {
    part: number | null;
    linked_service_index: number | null;
    is_required: boolean;
  })[];
}

// Técnico atribuível a uma OS (perfil Técnico ativo).
export interface Technician {
  id: number;
  name: string;
  technical_specialty: string;
  technical_specialty_display: string;
}

// Uma linha da timeline de status. `from_status` vazio = criação da OS.
export interface OrderStatusHistoryEntry {
  id: number;
  from_status: string;
  from_status_display: string;
  to_status: string;
  to_status_display: string;
  action: string;
  changed_by_name: string | null;
  reason: string;
  note: string;
  source: string;
  source_display: string;
  created_at: string;
}

// Uma ação de transição disponível (vinda do backend, fonte da verdade).
export interface OrderTransition {
  action: string;
  label: string;
  target_status: OrderStatus | null;
  target_status_display: string | null;
  permission: string;
  reason_required: boolean;
  critical: boolean;
  // O usuário tem a permissão para executar esta ação. Quando false, o botão
  // aparece desabilitado (não some) para deixar claro que a ação existe.
  permitted: boolean;
  available: boolean;
  block_reason: string;
  reopen_targets?: { value: OrderStatus; label: string }[];
}

export interface OrderTransitionsResponse {
  status: OrderStatus;
  status_display: string;
  transitions: OrderTransition[];
}

export interface TransitionPayload {
  action: string;
  reason?: string;
  notes?: string;
  target_status?: OrderStatus;
}

export type AttachmentCategory =
  | "entry"
  | "external_damage"
  | "internal_damage"
  | "engine"
  | "suspension"
  | "brakes"
  | "damaged_part"
  | "in_progress"
  | "completed"
  | "delivery"
  | "other";

export interface OrderAttachment {
  id: number;
  file: string;
  original_name: string;
  content_type: string;
  size: number;
  category: AttachmentCategory;
  category_display: string;
  caption: string;
  uploaded_by_name: string | null;
  is_image: boolean;
  created_at: string;
}

export type OrderEventType =
  | "created"
  | "status_changed"
  | "attachment_added"
  | "attachment_removed"
  | "quote_created"
  | "quote_sent"
  | "quote_approved"
  | "quote_partially_approved"
  | "quote_rejected"
  | "payment_registered"
  | "payment_removed"
  | "customer_notified";

export interface OrderEvent {
  id: number;
  event_type: OrderEventType;
  event_type_display: string;
  description: string;
  actor_name: string | null;
  channel: string;
  created_at: string;
}
