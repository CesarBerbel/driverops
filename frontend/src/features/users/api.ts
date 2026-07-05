import { apiClient } from "@/lib/api-client";

import type {
  AuditEntry,
  ManagedUser,
  Role,
  UserPayload,
  UserPermissionsResponse,
} from "./types";

export interface ListUsersParams {
  search?: string;
  role?: string;
  specialty?: string;
  status?: "active" | "inactive" | "all";
}

export async function listUsers(params: ListUsersParams = {}): Promise<ManagedUser[]> {
  const { data } = await apiClient.get<ManagedUser[]>("/users/", { params });
  return data;
}

export async function createUser(payload: UserPayload): Promise<ManagedUser> {
  const { data } = await apiClient.post<ManagedUser>("/users/", payload);
  return data;
}

export async function updateUser(
  id: number,
  payload: Partial<UserPayload>,
): Promise<ManagedUser> {
  const { data } = await apiClient.patch<ManagedUser>(`/users/${id}/`, payload);
  return data;
}

export async function deactivateUser(id: number): Promise<void> {
  await apiClient.delete(`/users/${id}/`);
}

export async function reactivateUser(id: number): Promise<ManagedUser> {
  const { data } = await apiClient.post<ManagedUser>(`/users/${id}/reactivate/`);
  return data;
}

export async function resetUserPassword(
  id: number,
  password?: string,
): Promise<ManagedUser> {
  const { data } = await apiClient.post<ManagedUser>(`/users/${id}/reset-password/`, {
    password: password || "",
  });
  return data;
}

export async function forceUserPasswordChange(id: number): Promise<ManagedUser> {
  const { data } = await apiClient.post<ManagedUser>(
    `/users/${id}/force-password-change/`,
  );
  return data;
}

export async function listRoles(): Promise<Role[]> {
  const { data } = await apiClient.get<Role[]>("/roles/");
  return data;
}

export async function getUserPermissions(
  id: number,
): Promise<UserPermissionsResponse> {
  const { data } = await apiClient.get<UserPermissionsResponse>(
    `/users/${id}/permissions/`,
  );
  return data;
}

export async function setUserPermissions(
  id: number,
  payload: { granted: string[]; revoked: string[] },
): Promise<UserPermissionsResponse> {
  const { data } = await apiClient.put<UserPermissionsResponse>(
    `/users/${id}/permissions/`,
    payload,
  );
  return data;
}

export async function listAudit(targetUser?: number): Promise<AuditEntry[]> {
  const { data } = await apiClient.get<AuditEntry[]>("/audit/", {
    params: { target_user: targetUser },
  });
  return data;
}
