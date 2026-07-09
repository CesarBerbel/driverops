export type LeadStatus =
  | "new"
  | "in_analysis"
  | "contacted"
  | "awaiting_return"
  | "converted_customer"
  | "converted_appointment"
  | "converted_os"
  | "converted_quote"
  | "duplicate"
  | "no_success"
  | "canceled";

export interface KeyLabel {
  key: string;
  label: string;
}

export interface LeadPublicConfig {
  is_active: boolean;
  email_required: boolean;
  plate_required: boolean;
  allow_without_vehicle: boolean;
  require_consent: boolean;
  request_types: KeyLabel[];
  periods: KeyLabel[];
}

export interface LeadRequestPayload {
  name: string;
  phone: string;
  email?: string;
  vehicle_plate?: string;
  vehicle_brand?: string;
  vehicle_model?: string;
  vehicle_year?: number | null;
  vehicle_mileage?: number | null;
  request_type: string;
  best_period: string;
  desired_date?: string | null;
  message?: string;
  consent: boolean;
  website?: string; // honeypot
}

export interface LeadIndicators {
  customer_existing: boolean;
  vehicle_existing: boolean;
  vehicle_divergent: boolean;
  has_open_os: boolean;
}

export interface LeadListItem {
  id: number;
  name: string;
  phone: string;
  email: string;
  vehicle_plate: string;
  vehicle_brand: string;
  vehicle_model: string;
  vehicle_year: number | null;
  request_type: string;
  request_type_display: string;
  best_period: string;
  best_period_display: string;
  desired_date: string | null;
  status: LeadStatus;
  status_display: string;
  assigned_to: number | null;
  assigned_to_name: string | null;
  created_at: string;
  indicators: LeadIndicators;
}

export interface CustomerBrief {
  id: number;
  name: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  document?: string;
}

export interface LeadAnalysis {
  customer_match: {
    confidence: "high" | "possible" | "conflict" | "new";
    customer: CustomerBrief | null;
    candidates: CustomerBrief[];
  };
  vehicle_match: {
    found: boolean;
    vehicle: { id: number; license_plate: string; brand: string; model: string; year: number | null } | null;
    owner: CustomerBrief | null;
  };
  verification:
    | "confirmed"
    | "probable"
    | "divergent"
    | "vehicle_not_found"
    | "customer_not_found"
    | "inconclusive";
  vehicle_belongs_to_other_customer: boolean;
}

export interface LeadEvent {
  id: number;
  event_type: string;
  event_type_display: string;
  description: string;
  from_status: string;
  to_status: string;
  actor_name: string | null;
  created_at: string;
}

export interface LeadDetail extends LeadListItem {
  message: string;
  document: string;
  vehicle_mileage: number | null;
  consent: boolean;
  source: string;
  updated_at: string;
  linked_customer: { id: number; name: string; phone: string; whatsapp: string } | null;
  linked_vehicle: {
    id: number;
    license_plate: string;
    brand: string;
    model: string;
    customer_id: number;
  } | null;
  work_order: { id: number; number: number } | null;
  analysis: LeadAnalysis;
  events: LeadEvent[];
}

export interface LeadSettings {
  is_active: boolean;
  email_required: boolean;
  plate_required: boolean;
  allow_without_vehicle: boolean;
  require_consent: boolean;
  sla_hours: number;
  auto_reply_enabled: boolean;
  notify_email: boolean;
  allow_create_os: boolean;
  require_review_on_divergence: boolean;
  block_conversion_when_vehicle_other_customer: boolean;
  updated_at: string;
  updated_by_name: string | null;
}
