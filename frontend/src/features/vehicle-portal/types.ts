export interface PortalTimelineEntry {
  status: string;
  status_display: string;
  at: string;
}

export interface PortalQuote {
  number: number;
  status: string;
  status_display: string;
  approval_url: string;
}

export interface PortalOrderSummary {
  id: number;
  number: number;
  opened_at: string | null;
  status: string;
  status_display: string;
  final_value: string;
}

export interface PortalOrderDetail extends PortalOrderSummary {
  expected_delivery: string | null;
  customer_report: string;
  diagnosis: string;
  updated_at: string;
  timeline: PortalTimelineEntry[];
  quote: PortalQuote | null;
  has_pdf: boolean;
}

export interface VehiclePortal {
  vehicle: {
    plate: string;
    brand: string;
    model: string;
    year: string;
    color: string;
    mileage: number | null;
  };
  customer_first_name: string;
  current_order: PortalOrderDetail | null;
  history: PortalOrderSummary[];
  workshop: { name: string; whatsapp: string; phone: string; logo: string };
  options: {
    allow_messages: boolean;
    allow_pdf_download: boolean;
    show_history: boolean;
  };
}

export type PortalMessageKind =
  | "quote"
  | "progress"
  | "callback"
  | "pickup"
  | "other";
