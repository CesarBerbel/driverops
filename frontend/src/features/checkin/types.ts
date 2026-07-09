export type CheckInStatus = "in_progress" | "completed" | "reviewed";
export type Severity = "light" | "medium" | "severe";
export type ItemStatus = "present" | "absent" | "na" | "unchecked";
export type FuelLevel =
  | "not_checked"
  | "reserve"
  | "quarter"
  | "half"
  | "three_quarters"
  | "full";
export type YesNoUnknown = "yes" | "no" | "not_verified";

export interface DamagePhoto {
  id: number;
  url: string;
  caption: string;
  created_at: string;
}

export interface Damage {
  id: number;
  x: string;
  y: string;
  sequence: number;
  region: string;
  region_display: string;
  damage_type: string;
  damage_type_display: string;
  severity: Severity;
  severity_display: string;
  description: string;
  internal_notes: string;
  visible_to_customer: boolean;
  photos: DamagePhoto[];
  created_by_name: string | null;
  created_at: string;
}

export interface CheckInPhoto {
  id: number;
  category: string;
  category_display: string;
  url: string;
  caption: string;
  created_at: string;
}

export interface CheckInItem {
  id: number;
  name: string;
  status: ItemStatus;
  notes: string;
  position: number;
}

export interface Belonging {
  id: number;
  description: string;
  location: string;
  notes: string;
  photo_url: string;
  created_at: string;
}

export interface CheckInSummary {
  damage_count: number;
  photo_count: number;
  absent_items_count: number;
  has_belongings: boolean;
}

export interface CheckIn {
  id: number;
  order: number;
  status: CheckInStatus;
  status_display: string;
  is_locked: boolean;
  mileage: number | null;
  fuel_level: FuelLevel;
  fuel_level_display: string;
  external_condition: string;
  internal_condition: string;
  general_notes: string;
  arrived_driving: boolean;
  arrived_towed: boolean;
  customer_present: boolean;
  customer_confirmed: boolean;
  belongings_status: YesNoUnknown;
  damages: Damage[];
  photos: CheckInPhoto[];
  items: CheckInItem[];
  belongings: Belonging[];
  summary: CheckInSummary;
  created_by_name: string | null;
  completed_by_name: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DamagePayload {
  check_in?: number;
  x?: number;
  y?: number;
  region?: string;
  damage_type?: string;
  severity?: Severity;
  description?: string;
  internal_notes?: string;
  visible_to_customer?: boolean;
}
