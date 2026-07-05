export interface Role {
  id: number;
  key: string;
  name: string;
  description: string;
  is_system: boolean;
  permission_codes: string[];
}

export interface ManagedUser {
  id: number;
  email: string;
  full_name: string;
  phone: string;
  whatsapp: string;
  role: number | null;
  role_name: string | null;
  role_key: string | null;
  technical_specialty: string;
  technical_specialty_display: string;
  is_active: boolean;
  is_superuser: boolean;
  force_password_change: boolean;
  notes: string;
  last_login: string | null;
  date_joined: string;
}

export interface UserPayload {
  email: string;
  full_name: string;
  phone: string;
  whatsapp: string;
  role: number | null;
  technical_specialty: string;
  is_active: boolean;
  force_password_change: boolean;
  notes: string;
  password?: string;
  send_invite?: boolean;
}

export interface PermissionItem {
  codename: string;
  action: string;
  label: string;
  is_critical: boolean;
  inherited: boolean;
  granted: boolean;
  revoked: boolean;
  effective: boolean;
}

export interface PermissionModule {
  module: string;
  label: string;
  permissions: PermissionItem[];
}

export interface UserPermissionsResponse {
  user: {
    id: number;
    email: string;
    full_name: string;
    role_key: string | null;
    role_name: string | null;
    is_superuser: boolean;
  };
  modules: PermissionModule[];
}

export interface AuditEntry {
  id: number;
  action: string;
  actor_email: string | null;
  target_email: string | null;
  old_value: unknown;
  new_value: unknown;
  ip: string | null;
  user_agent: string;
  created_at: string;
}
