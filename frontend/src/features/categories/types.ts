export type CategoryType = "client" | "part" | "service";

export interface Category {
  id: number;
  category_type: CategoryType;
  name: string;
  description: string;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type CategoryStatusFilter = "active" | "inactive" | "all";
