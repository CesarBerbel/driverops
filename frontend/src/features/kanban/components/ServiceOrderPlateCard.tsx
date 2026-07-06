import { AlertTriangle, MoveRight, Wrench } from "lucide-react";

import { ContactLink } from "@/components/shared/ContactLink";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { allowedTargets, statusLabel } from "@/features/orders/constants";
import { formatOrderNumber } from "@/features/orders/lib/orderMapping";
import type { OrderStatus, WorkOrder } from "@/features/orders/types";
import { formatPlateForDisplay } from "@/features/vehicles/plate";
import { formatCurrencyBRL } from "@/lib/masks";
import { cn } from "@/lib/utils";

import { formatBrDate, isOverdue } from "@/features/dashboard/osStatus";

interface ServiceOrderPlateCardProps {
  order: WorkOrder;
  onSelect: (order: WorkOrder) => void;
  onMove: (order: WorkOrder, status: OrderStatus) => void;
  onDragStart?: (order: WorkOrder) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  // Disabled in the mobile/tablet accordion, where the "Mover" menu is used.
  draggable?: boolean;
}

// Card em formato de placa de carro: a placa (padrão Mercosul) é o elemento mais
// destacado. Abaixo vêm OS, cliente e WhatsApp clicável; extras (veículo,
// previsão, valor, atraso) aparecem de forma discreta sem poluir o card.
export function ServiceOrderPlateCard({
  order,
  onSelect,
  onMove,
  onDragStart,
  onDragEnd,
  isDragging = false,
  draggable = true,
}: ServiceOrderPlateCardProps) {
  const overdue = isOverdue(order);
  const targets = allowedTargets(order.status);

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={
        draggable
          ? (event) => {
              event.dataTransfer.setData("text/plain", String(order.id));
              event.dataTransfer.effectAllowed = "move";
              onDragStart?.(order);
            }
          : undefined
      }
      onDragEnd={draggable ? onDragEnd : undefined}
      onClick={() => onSelect(order)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(order);
        }
      }}
      aria-label={`Ordem de serviço ${formatOrderNumber(order.number)} — ${order.vehicle_plate}`}
      className={cn(
        "group relative rounded-lg border bg-card p-2.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        draggable && "cursor-grab active:cursor-grabbing",
        overdue && "border-destructive/60",
        isDragging && "rotate-1 opacity-50 shadow-lg ring-2 ring-primary",
      )}
    >
      {/* Placa -- elemento mais destacado (proporção horizontal) */}
      <div className="overflow-hidden rounded-md border-2 border-slate-800 bg-white shadow-sm">
        <div className="bg-blue-700 px-2 py-px text-center text-[7px] font-bold tracking-[0.3em] text-white">
          BRASIL
        </div>
        <div className="px-2 py-1 text-center font-mono text-xl font-extrabold tracking-[0.2em] text-slate-900">
          {formatPlateForDisplay(order.vehicle_plate)}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">
          {formatOrderNumber(order.number)}
        </span>
        {targets.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 shrink-0 text-muted-foreground opacity-60 hover:opacity-100"
                aria-label="Mover OS de status"
                onClick={(event) => event.stopPropagation()}
              >
                <MoveRight className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={(event) => event.stopPropagation()}
            >
              <DropdownMenuLabel>Mover para</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {targets.map((target) => (
                <DropdownMenuItem
                  key={target}
                  onSelect={() => onMove(order, target)}
                >
                  {statusLabel(target)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <p className="mt-1 truncate text-sm font-medium">{order.customer_name}</p>
      <ContactLink
        whatsapp={order.customer_whatsapp}
        phone={order.customer_phone}
        emptyText="WhatsApp não informado"
        className="mt-0.5 text-xs"
      />

      {/* Extras discretos */}
      <div className="mt-2 space-y-1 border-t pt-2 text-[11px] text-muted-foreground">
        {order.vehicle_description && (
          <p className="truncate">{order.vehicle_description}</p>
        )}
        {order.assigned_technician_name && (
          <p className="flex items-center gap-1 truncate">
            <Wrench className="size-3 shrink-0" />
            {order.assigned_technician_name}
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-foreground">
            {formatCurrencyBRL(Number(order.final_value))}
          </span>
          {order.expected_delivery && (
            <span className={cn(overdue && "font-medium text-destructive")}>
              {overdue && <AlertTriangle className="mr-1 inline size-3 align-[-2px]" />}
              {formatBrDate(order.expected_delivery)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
