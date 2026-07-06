import { useQuery } from "@tanstack/react-query";
import { XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

import { listStatusHistory } from "../api";
import { IN_PROGRESS_STATUSES, OPEN_STATUSES, statusLabel } from "../constants";
import type { OrderStatus } from "../types";

// Fluxo linear de status da OS (o "caminho feliz"), da abertura à finalização.
// "Cancelada" é terminal e fica fora do fluxo -- tratada à parte.
const STATUS_FLOW: OrderStatus[] = [
  ...OPEN_STATUSES,
  ...IN_PROGRESS_STATUSES,
  "finished",
];

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

interface OrderStatusStepperProps {
  status: OrderStatus;
  // Quando presente, busca o histórico para datar cada etapa alcançada.
  orderId?: number | null;
}

// Linha do tempo do status da OS que ocupa toda a largura disponível: as etapas
// são distribuídas igualmente, ligadas por uma linha contínua, com as concluídas
// e a atual preenchidas e as futuras esmaecidas. Abaixo de cada marcador ficam o
// nome do status e a data em que a OS entrou nele (quando já alcançado). Reflete
// ao vivo o status selecionado no formulário.
export function OrderStatusStepper({ status, orderId }: OrderStatusStepperProps) {
  const { data: history } = useQuery({
    queryKey: ["work-orders", orderId, "status-history"],
    queryFn: () => listStatusHistory(orderId as number),
    enabled: orderId != null,
  });

  // Data em que cada status foi alcançado (primeira vez). O histórico vem do mais
  // recente ao mais antigo, então sobrescrever mantém a ocorrência mais antiga.
  const reachedAt: Partial<Record<OrderStatus, string>> = {};
  for (const entry of history ?? []) {
    reachedAt[entry.to_status as OrderStatus] = entry.created_at;
  }

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
      className="flex min-w-0 flex-1 items-start"
      aria-label={`Linha do tempo de status da OS -- atual: ${statusLabel(status)}`}
    >
      {STATUS_FLOW.map((step, index) => {
        const done = index < currentIndex;
        const current = index === currentIndex;
        const date = reachedAt[step];
        return (
          <li key={step} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            {/* Marcador + conectores (linha contínua entre as etapas). */}
            <div className="flex w-full items-center">
              <span
                className={cn(
                  "h-px flex-1",
                  index === 0 && "invisible",
                  done || current ? "bg-primary" : "bg-border",
                )}
              />
              <span
                title={statusLabel(step)}
                className={cn(
                  "size-2.5 shrink-0 rounded-full transition-colors",
                  done || current ? "bg-primary" : "bg-muted-foreground/30",
                  current && "ring-2 ring-primary/30",
                )}
              />
              <span
                className={cn(
                  "h-px flex-1",
                  index === STATUS_FLOW.length - 1 && "invisible",
                  done ? "bg-primary" : "bg-border",
                )}
              />
            </div>
            {/* Nome do status + data em que a OS entrou nele. */}
            <span
              className={cn(
                "px-0.5 text-center text-[10px] leading-tight",
                current ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {statusLabel(step)}
            </span>
            {date && (
              <span className="text-center text-[10px] leading-tight text-muted-foreground">
                {formatShortDate(date)}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
