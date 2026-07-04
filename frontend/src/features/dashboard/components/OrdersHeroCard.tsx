import { ArrowRight, ClipboardList } from "lucide-react";
import { Link } from "react-router-dom";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Card de acesso às Ordens de Serviço, em destaque no topo do Dashboard (fora
// das abas), por ser a principal ação operacional do sistema.
export function OrdersHeroCard() {
  return (
    <Link to="/orders" className="block">
      <Card className="border-primary/40 bg-primary/5 shadow-sm transition-colors hover:bg-primary/10">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <ClipboardList className="size-6" />
            </span>
            <div className="space-y-1">
              <CardTitle className="text-xl">Ordens de Serviço</CardTitle>
              <CardDescription className="text-sm">
                Criar, acompanhar e finalizar atendimentos da oficina.
              </CardDescription>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Acessar ordens de serviço
            <ArrowRight className="size-4" />
          </span>
        </CardHeader>
      </Card>
    </Link>
  );
}
