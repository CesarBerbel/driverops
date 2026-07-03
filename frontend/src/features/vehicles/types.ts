export type FuelType =
  | "gasoline"
  | "ethanol"
  | "flex"
  | "diesel"
  | "hybrid"
  | "electric"
  | "cng"
  | "other";

export type Transmission = "manual" | "automatic" | "automated" | "cvt" | "other";

export type Steering =
  | "mechanical"
  | "hydraulic"
  | "electric"
  | "electrohydraulic"
  | "other";

export type VehicleType =
  | "car"
  | "motorcycle"
  | "pickup"
  | "van"
  | "truck"
  | "utility"
  | "other";

export type UsageCategory =
  | "private"
  | "commercial"
  | "ride_hailing"
  | "taxi"
  | "fleet"
  | "other";

export type VehicleStatusFilter = "active" | "inactive" | "all";

export interface Vehicle {
  id: number;
  customer: number;
  customer_name: string;
  license_plate: string;
  brand: string;
  model: string;
  version: string;
  manufacture_year: number | null;
  model_year: number | null;
  color: string;
  mileage: number | null;
  fuel_type: FuelType | "";
  transmission: Transmission | "";
  steering: Steering | "";
  doors: number | null;
  air_conditioning: boolean | null;
  is_modified: boolean | null;
  modification_notes: string;
  vehicle_type: VehicleType | "";
  usage_category: UsageCategory | "";
  chassis: string;
  renavam: string;
  fipe_code: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export type VehiclePayload = Omit<
  Vehicle,
  "id" | "customer_name" | "created_at" | "updated_at"
>;
