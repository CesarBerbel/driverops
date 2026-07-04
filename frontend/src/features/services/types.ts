export type ServiceStatusFilter = "active" | "inactive" | "all";

export type DiscountType = "none" | "percent" | "fixed";

export interface ServicePart {
  part: number;
  part_name: string;
  // DRF DecimalField serializes as a JSON string.
  suggested_quantity: string;
}

export interface Service {
  id: number;
  name: string;
  category: number;
  category_name: string;
  description: string;
  labor_cost: string;
  estimated_minutes: number | null;
  notes: string;
  standard_parts: ServicePart[];
  value: string;
  created_at: string;
  updated_at: string;
}

export interface PackageServiceItem {
  service: number;
  service_name: string;
  service_value: string;
}

export interface ServicePackage {
  id: number;
  name: string;
  description: string;
  items: PackageServiceItem[];
  total_value: string;
  discount_type: DiscountType;
  discount_value: string;
  final_value: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ServicePayload {
  name: string;
  category: number;
  description: string;
  labor_cost: string;
  estimated_minutes: number | null;
  notes: string;
  standard_parts: { part: number; suggested_quantity: string }[];
}

export interface ServicePackagePayload {
  name: string;
  description: string;
  discount_type: DiscountType;
  discount_value: string;
  notes: string;
  items: { service: number }[];
}
