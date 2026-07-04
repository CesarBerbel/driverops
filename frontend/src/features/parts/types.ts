export type UnitOfMeasure =
  | "unit"
  | "pair"
  | "kit"
  | "liter"
  | "milliliter"
  | "meter"
  | "centimeter"
  | "box"
  | "pack"
  | "set"
  | "other";

export type PartStatusFilter = "active" | "inactive" | "all";

export interface Part {
  id: number;
  category: number;
  category_name: string;
  name: string;
  internal_code: string;
  brand: string;
  model_application: string;
  unit_of_measure: UnitOfMeasure;
  // DRF DecimalField serializes as a JSON string, not a number.
  current_quantity: string;
  min_quantity: string | null;
  cost_price: string | null;
  sale_price: string | null;
  location: string;
  supplier: number | null;
  supplier_name: string | null;
  ncm: string;
  barcode: string;
  notes: string;
  is_low_stock: boolean;
  created_at: string;
  updated_at: string;
}

export type PartPayload = Omit<
  Part,
  "id" | "category_name" | "supplier_name" | "is_low_stock" | "created_at" | "updated_at"
>;
