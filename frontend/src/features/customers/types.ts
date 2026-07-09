export type CustomerType = "individual" | "company";

export interface Customer {
  id: number;
  name: string;
  customer_type: CustomerType;
  email: string;
  phone: string;
  whatsapp: string;
  document: string;
  zip_code: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
  notes: string;
  is_active: boolean;
  vehicle_count: number;
  created_at: string;
  updated_at: string;
}

export type CustomerPayload = Omit<
  Customer,
  "id" | "is_active" | "created_at" | "updated_at"
>;
