import { apiClient } from "@/lib/api-client";

import type { Category, CategoryStatusFilter, CategoryType } from "./types";

export async function listCategories(
  categoryType: CategoryType,
  status: CategoryStatusFilter,
): Promise<Category[]> {
  const { data } = await apiClient.get<Category[]>("/categories/", {
    params: { category_type: categoryType, status },
  });
  return data;
}

export async function createCategory(payload: {
  category_type: CategoryType;
  name: string;
  description?: string;
  notes?: string;
}): Promise<Category> {
  const { data } = await apiClient.post<Category>("/categories/", payload);
  return data;
}

export async function updateCategory(
  id: number,
  payload: { name: string; description?: string; notes?: string },
): Promise<Category> {
  const { data } = await apiClient.patch<Category>(`/categories/${id}/`, payload);
  return data;
}

export async function deleteCategory(id: number): Promise<void> {
  await apiClient.delete(`/categories/${id}/`);
}

export async function reactivateCategory(id: number): Promise<Category> {
  const { data } = await apiClient.post<Category>(`/categories/${id}/reactivate/`);
  return data;
}
