export type QuoteStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "partially_approved"
  | "approved"
  | "rejected"
  | "expired"
  | "canceled";

export type QuoteChannel = "physical" | "tablet" | "email_link" | "";

export type QuoteItemKind = "service" | "package" | "part";

export type QuoteItemStatus = "pending" | "approved" | "rejected";

export interface QuoteItem {
  id: number;
  kind: QuoteItemKind;
  kind_display: string;
  description: string;
  quantity: string;
  unit_price: string;
  subtotal: string;
  is_custom: boolean;
  notes: string;
  status: QuoteItemStatus;
  status_display: string;
  // Peça vinculada a um serviço (peça padrão): aprovada/recusada junto com ele.
  // Nulo para serviços, pacotes e peças independentes.
  linked_service: number | null;
}

export interface QuoteTotals {
  services_total: string;
  packages_total: string;
  parts_total: string;
  gross_total: string;
  total_quoted: string;
  total_approved: string;
  total_rejected: string;
  total_pending: string;
  discount_value: string;
  final_value: string;
}

export interface Quote {
  id: number;
  number: number;
  version: number;
  status: QuoteStatus;
  status_display: string;
  work_order: number;
  work_order_number: number;
  customer_name: string;
  customer_email: string;
  vehicle_plate: string;
  customer_report: string;
  diagnosis: string;
  discount_type: string;
  discount_value: string;
  valid_until: string | null;
  public_token: string;
  items: QuoteItem[];
  totals: QuoteTotals;
  created_by_name: string;
  created_at: string;
  sent_at: string | null;
  sent_to_email: string;
  viewed_at: string | null;
  decided_at: string | null;
  approval_channel: QuoteChannel;
  channel_display: string;
  approved_by_name: string;
  client_name: string;
  terms_accepted: boolean;
  rejection_reason: string;
  approval_note: string;
  decision_ip: string | null;
  decision_user_agent: string;
  signature_image: string | null;
  signed_document: string | null;
}

// Subconjunto seguro exposto na página pública de aprovação.
export interface PublicQuote {
  number: number;
  version: number;
  status: QuoteStatus;
  status_display: string;
  can_decide: boolean;
  work_order_number: number;
  customer_name: string;
  vehicle_plate: string;
  vehicle_description: string;
  customer_report: string;
  diagnosis: string;
  valid_until: string | null;
  discount_type: string;
  items: QuoteItem[];
  totals: QuoteTotals;
  client_name: string;
  decided_at: string | null;
  rejection_reason: string;
  workshop: {
    trade_name: string;
    legal_name: string;
    cnpj: string;
    phone: string;
    whatsapp: string;
    email: string;
    city: string;
    state: string;
    logo: string | null;
  };
  terms: {
    quote_terms: string;
    warranty_terms: string;
    service_authorization_terms: string;
  };
}
