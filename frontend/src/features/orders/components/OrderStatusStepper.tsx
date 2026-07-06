import { XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

import { IN_PROGRESS_STATUSES, OPEN_STATUSES, statusLabel } from "../constants";
import type { OrderStatus } from "../types";

// Fluxo linear de status da OS (o "caminho feliz"), da abertura à finalização.
// "Cancelada" é terminal e fica fora do fluxo -- tratada à parte.
const STATUS_FLOW: OrderStatus[] = [
  ...OPEN_STATUSES,
  ...IN_PROGRESS_STATUSES,
  "finished",
];

// Linha do tempo compacta do status da OS: bolinhas ligadas por linhas, com as
// etapas concluídas/atual preenchidas e as futuras esmaecidas. Reflete o status
// selecionado no formulário ao vivo. Passe o mouse numa etapa para ver o nome.
export function OrderStatusStepper({ status }: { status: OrderStatus }) {
  if (status === "canceled") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive"
        aria-label="Ordem de serviço cancelada"
      >
        <XCircle className="size-3.5" />
        OS cancelada
      </span>
    );
  }

  const currentIndex = STATUS_FLOW.indexOf(status);

  return (
    <ol
      className="flex min-w-0 items-center overflow-x-auto"
      aria-label={`Linha do tempo de status da OS -- atual: ${statusLabel(status)}`}
    >
      {STATUS_FLOW.map((step, index) => {
        const done = index < currentIndex;
        const current = index === currentIndex;
        return (
          <li key={step} className="flex shrink-0 items-center">
            <span
              title={statusLabel(step)}
              className={cn(
                "size-2.5 shrink-0 rounded-full transition-colors",
                (done || current) && "bg-primary",
                current && "ring-2 ring-primary/30",
                !done && !current && "bg-muted-foreground/30",
              )}
            />
            {current && (
              <span className="ml-1.5 whitespace-nowrap text-xs font-medium">
                {statusLabel(step)}
              </span>
            )}
            {index < STATUS_FLOW.length - 1 && (
              <span
                className={cn(
                  "mx-1.5 h-px w-4 shrink-0",
                  done ? "bg-primary" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
