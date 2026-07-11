import { Clock, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrencyBRL } from "@/lib/masks";

import type { Service } from "../types";

// Card mobile do serviço: espelha a linha da tabela (nome, categoria, valor,
// duração estimada e status), com a mesma ação de abrir/editar da linha.
export function ServiceMobileCard({
  service,
  active = true,
  onEdit,
}: {
  service: Service;
  active?: boolean;
  onEdit?: () => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          {onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="text-left text-sm font-semibold text-primary hover:underline focus-visible:underline focus-visible:outline-none"
            >
              {service.name}
            </button>
          ) : (
            <span className="text-sm font-semibold">{service.name}</span>
          )}
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
              active ? "bg-muted" : "bg-destructive/10 text-destructive",
            )}
          >
            {active ? "Ativo" : "Inativo"}
          </span>
        </div>

        {service.category_name && (
          <p className="text-sm text-muted-foreground">{service.category_name}</p>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {formatCurrencyBRL(Number(service.value))}
          </span>
          {service.estimated_minutes != null && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {service.estimated_minutes} min
            </span>
          )}
        </div>

        {onEdit && (
          <div className="pt-1">
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              title="Editar serviço"
              aria-label="Editar serviço"
              onClick={onEdit}
            >
              <Pencil className="size-4" />
              Editar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
