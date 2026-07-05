export interface User {
  id: number;
  email: string;
  full_name: string;
  is_staff: boolean;
  is_superuser: boolean;
  date_joined: string;
  role: string | null;
  role_name: string | null;
  technical_specialty: string;
  technical_specialty_display: string;
  force_password_change: boolean;
  permissions: string[];
}
