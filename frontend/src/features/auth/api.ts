import { apiClient } from "@/lib/api-client";

import type { User } from "./types";

export async function fetchMe(): Promise<User> {
  const { data } = await apiClient.get<User>("/users/me/");
  return data;
}

export async function login(email: string, password: string): Promise<User> {
  const { data } = await apiClient.post<{ user: User }>("/auth/login/", { email, password });
  return data.user;
}

export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout/");
}

export async function updateProfile(full_name: string): Promise<User> {
  const { data } = await apiClient.patch<User>("/users/me/", { full_name });
  return data;
}

export async function changePassword(payload: {
  current_password: string;
  new_password: string;
  new_password_confirm: string;
}): Promise<void> {
  await apiClient.post("/users/change-password/", payload);
}

export async function requestPasswordReset(email: string): Promise<void> {
  await apiClient.post("/auth/password-reset/", { email });
}

export async function confirmPasswordReset(payload: {
  uid: string;
  token: string;
  new_password: string;
  new_password_confirm: string;
}): Promise<void> {
  await apiClient.post("/auth/password-reset/confirm/", payload);
}

export async function adminPing(): Promise<{ detail: string }> {
  const { data } = await apiClient.get<{ detail: string }>("/admin/ping/");
  return data;
}
