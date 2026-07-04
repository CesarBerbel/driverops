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
  | "canceled";

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
  created_at: string;
  updated_at: string;
}

export interface WorkOrderLinePayload {
  description: string;
  quantity: string;
  unit_price: string;
}

export interface WorkOrderPayload {
  customer: number;
  vehicle: number;
  status: OrderStatus;
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
  part_items: (WorkOrderLinePayload & { part: number | null })[];
}
