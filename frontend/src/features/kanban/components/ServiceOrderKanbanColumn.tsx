import { useState } from "react";

import { canTransition, statusLabel } from "@/features/orders/constants";
import type { OrderStatus, WorkOrder } from "@/features/orders/types";
import { statusPillClass } from "@/features/dashboard/osStatus";
import { cn } from "@/lib/utils";

import { ServiceOrderPlateCard } from "./ServiceOrderPlateCard";

interface ServiceOrderKanbanColumnProps {
  status: OrderStatus;
  orders: WorkOrder[];
  draggingOrder: WorkOrder | null;
  onSelect: (order: WorkOrder) => void;
  onMove: (order: WorkOrder, status: OrderStatus) => void;
  onDragStart: (order: WorkOrder) => void;
  onDragEnd: () => void;
  onDrop: (status: OrderStatus) => void;
}

export function ServiceOrderKanbanColumn({
  status,
  orders,
  draggingOrder,
  onSelect,
  onMove,
  onDragStart,
  onDragEnd,
  onDrop,
}: ServiceOrderKanbanColumnProps) {
  const [isOver, setIsOver] = useState(false);

  // A column can receive the dragged card only when the transition is allowed
  // (and it isn't the card's own column). Mirrors the backend rules.
  const canReceive =
    draggingOrder !== null &&
    draggingOrder.status !== status &&
    canTransition(draggingOrder.status, status);

  return (
    <section
      aria-label={`Coluna ${statusLabel(status)}`}
      className="flex h-full w-72 shrink-0 snap-start flex-col rounded-lg border bg-muted/30"
      onDragOver={(event) => {
        if (canReceive) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          if (!isOver) setIsOver(true);
        }
      }}
      onDragLeave={(event) => {
        // Ignore leave events bubbling from children still inside the column.
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setIsOver(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsOver(false);
        if (canReceive) onDrop(status);
      }}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2.5">
        <span className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", statusPillClass(status))} />
          <h2 className="text-sm font-semibold tracking-tight">{statusLabel(status)}</h2>
        </span>
        <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {orders.length}
        </span>
      </header>

      <div
        className={cn(
          "flex-1 space-y-2 overflow-y-auto rounded-b-lg p-2 transition-colors",
          canReceive && "bg-primary/5",
          isOver && "ring-2 ring-inset ring-primary",
        )}
      >
        {orders.length === 0 ? (
          <p className="mt-6 px-2 text-center text-xs text-muted-foreground">
            {isOver ? "Solte para mover para cá" : "Nenhuma OS."}
          </p>
        ) : (
          orders.map((order) => (
            <ServiceOrderPlateCard
              key={order.id}
              order={order}
              onSelect={onSelect}
              onMove={onMove}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              isDragging={draggingOrder?.id === order.id}
            />
          ))
        )}
      </div>
    </section>
  );
}
