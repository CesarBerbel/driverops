export interface C360Customer {
  id: number;
  name: string;
  customer_type: string;
  customer_type_display: string;
  email: string;
  phone: string;
  whatsapp: string;
  document: string;
  address_line: string;
  city: string;
  state: string;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface C360Summary {
  vehicles: number;
  open_os: number;
  finished_os: number;
  pending_quotes: number;
  approved_quotes: number;
  total_value: string | null;
  open_value: string | null;
  last_visit: string | null;
  last_interaction: string | null;
  pending_count: number;
}

export interface C360Alert {
  type: string;
  severity: "info" | "warning" | "danger";
  message: string;
  link: string;
}

export interface C360Vehicle {
  id: number;
  license_plate: string;
  brand: string;
  model: string;
  model_year: number | null;
}

export interface OrderRow {
  id: number;
  number: number;
  status: string;
  status_display: string;
  opened_at: string;
  expected_delivery: string | null;
  vehicle_plate: string;
  customer_report: string;
  final_value: string;
  balance_due: string;
  is_overdue: boolean;
}

export interface QuoteRow {
  id: number;
  number: number;
  version: number;
  status: string;
  status_display: string;
  work_order: number | null;
  work_order_number: number | null;
  vehicle_plate: string;
  sent_at: string | null;
  decided_at: string | null;
  valid_until: string | null;
  created_at: string;
  public_token: string;
  final_value: string;
}

export interface Interaction {
  id: number;
  interaction_type: string;
  interaction_type_display: string;
  channel: string;
  title: string;
  summary: string;
  content: string;
  status: string;
  status_display: string;
  next_action: string;
  next_action_date: string | null;
  vehicle: number | null;
  vehicle_plate: string;
  work_order: number | null;
  work_order_number: number | null;
  quote: number | null;
  quote_number: number | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinancialSummary {
  total_value: string;
  paid_value: string;
  open_value: string;
  orders_with_balance: number;
  payments: {
    id: number;
    order_number: number | null;
    amount: string;
    method: string;
    paid_at: string;
  }[];
}

export interface TimelineEvent {
  date: string;
  type: string;
  title: string;
  link?: string;
}

export interface Customer360 {
  customer: C360Customer;
  summary: C360Summary;
  alerts: C360Alert[];
  vehicles: C360Vehicle[];
  open_orders: OrderRow[];
  last_finished_order: OrderRow | null;
  pending_quotes: QuoteRow[];
  recent_interactions: Interaction[];
  crm_count: number;
  can_financial: boolean;
  can_interactions: boolean;
}
