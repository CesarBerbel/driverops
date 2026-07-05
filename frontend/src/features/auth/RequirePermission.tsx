import { Outlet } from "react-router-dom";

import { AccessDeniedPage } from "./pages/AccessDeniedPage";
import { useHasPermission } from "./usePermission";

interface RequirePermissionProps {
  code: string;
}

// Guarda de rota por permissão. Usuários autenticados sem a permissão veem a tela
// de "Acesso negado" (a autenticação já é garantida por ProtectedRoute acima).
export function RequirePermission({ code }: RequirePermissionProps) {
  const allowed = useHasPermission(code);
  return allowed ? <Outlet /> : <AccessDeniedPage />;
}
