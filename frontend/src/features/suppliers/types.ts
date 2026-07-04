export type SupplierType = "individual" | "company";

export type SupplierStatusFilter = "active" | "inactive" | "all";

export interface Supplier {
  id: number;
  name: string;
  trade_name: string;
  supplier_type: SupplierType;
  document: string;
  state_registration: string;
  email: string;
  phone: string;
  whatsapp: string;
  contact_name: string;
  zip_code: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export type SupplierPayload = Omit<Supplier, "id" | "created_at" | "updated_at">;
