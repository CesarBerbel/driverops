import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

/**
 * Nome do cliente como link para a Central do Cliente 360°
 * (`/customers/:id/360`). Usado em qualquer lugar que exiba um cliente.
 *
 * - Sem `name`: renderiza o `fallback` (padrão "—").
 * - Com `name` mas sem `id`: renderiza apenas o texto (não há para onde levar).
 * - `stopPropagation` no clique evita disparar handlers do container (linhas
 *   clicáveis, cards de kanban/dashboard que abrem modal, etc.).
 */
export function CustomerLink({
  id,
  name,
  className,
  fallback = "—",
}: {
  id?: number | null;
  name?: string | null;
  className?: string;
  fallback?: string;
}) {
  if (!name) return <>{fallback}</>;
  if (id == null) return <>{name}</>;
  return (
    <Link
      to={`/customers/${id}/360`}
      className={cn("text-primary hover:underline", className)}
      onClick={(event) => event.stopPropagation()}
    >
      {name}
    </Link>
  );
}
