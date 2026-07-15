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

// Entrar com Google: envia o ID token do Google Identity Services; o backend
// verifica e só autentica usuários já existentes (vínculo automático por e-mail).
export async function googleLogin(credential: string): Promise<User> {
  const { data } = await apiClient.post<{ user: User }>("/auth/google/", { credential });
  return data.user;
}

// Vincular a conta Google do usuário logado (recebe o ID token do Google).
export async function linkGoogle(credential: string): Promise<User> {
  const { data } = await apiClient.post<User>("/users/me/link-google/", { credential });
  return data;
}

export async function unlinkGoogle(): Promise<User> {
  const { data } = await apiClient.delete<User>("/users/me/link-google/");
  return data;
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
