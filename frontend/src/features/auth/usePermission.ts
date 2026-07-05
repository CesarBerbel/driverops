import { useAuth } from "./useAuth";

// Verifica se o usuário logado tem uma permissão (código "modulo.acao").
// O superuser sempre tem acesso total.
export function useHasPermission(code: string): boolean {
  const { user } = useAuth();
  return Boolean(user?.is_superuser || user?.permissions?.includes(code));
}

// Retorna uma função de checagem reutilizável (para múltiplas verificações).
export function usePermissionCheck(): (code: string) => boolean {
  const { user } = useAuth();
  return (code: string) =>
    Boolean(user?.is_superuser || user?.permissions?.includes(code));
}
