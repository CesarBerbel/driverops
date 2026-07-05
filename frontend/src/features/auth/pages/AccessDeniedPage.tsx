import { ShieldX } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

export function AccessDeniedPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <ShieldX className="size-12 text-destructive" />
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Acesso negado</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Você não tem permissão para acessar esta área. Se acredita que deveria ter acesso,
          fale com um administrador do sistema.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link to="/dashboard">Voltar ao Dashboard</Link>
      </Button>
    </div>
  );
}
