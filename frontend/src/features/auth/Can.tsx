import type { ReactNode } from "react";

import { useHasPermission } from "./usePermission";

// Renderiza os filhos apenas se o usuário tiver a permissão (superuser sempre vê).
// Usado para ocultar botões/ações sem permissão. O backend também bloqueia a ação.
export function Can({ code, children }: { code: string; children: ReactNode }) {
  return useHasPermission(code) ? <>{children}</> : null;
}
