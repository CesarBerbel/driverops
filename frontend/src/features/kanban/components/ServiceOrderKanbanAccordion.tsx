import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { statusLabel } from "@/features/orders/constants";
import { statusPillClass } from "@/features/dashboard/osStatus";
import type { OrderStatus, WorkOrder } from "@/features/orders/types";
import { cn } from "@/lib/utils";

import { ServiceOrderPlateCard } from "./ServiceOrderPlateCard";

interface ServiceOrderKanbanAccordionProps {
  columns: OrderStatus[];
  ordersByStatus: (status: OrderStatus) => WorkOrder[];
  onSelect: (order: WorkOrder) => void;
  onMove: (order: WorkOrder, status: OrderStatus) => void;
}

// Mobile/tablet layout: the columns become stacked accordion sections. Each
// section expands to reveal its cards; status changes use the card "Mover" menu
// (no drag and drop on touch). The whole list scrolls vertically.
export function ServiceOrderKanbanAccordion({
  columns,
  ordersByStatus,
  onSelect,
  onMove,
}: ServiceOrderKanbanAccordionProps) {
  // Start with the first column expanded so there is visible content.
  const [open, setOpen] = useState<Set<OrderStatus>>(
    () => new Set(columns.slice(0, 1)),
  );

  function toggle(status: OrderStatus) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  return (
    <div className="h-full space-y-2 overflow-y-auto p-4">
      {columns.map((status) => {
        const orders = ordersByStatus(status);
        const isOpen = open.has(status);
        const panelId = `kanban-panel-${status}`;
        return (
          <section
            key={status}
            aria-label={`Coluna ${statusLabel(status)}`}
            className="overflow-hidden rounded-lg border bg-muted/30"
          >
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => toggle(status)}
              className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left"
            >
              <span className="flex items-center gap-2">
                <span className={cn("size-2.5 rounded-full", statusPillClass(status))} />
                <span className="text-sm font-semibold tracking-tight">
                  {statusLabel(status)}
                </span>
                <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {orders.length}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  isOpen && "rotate-180",
                )}
              />
            </button>

            {isOpen && (
              <div id={panelId} className="space-y-2 border-t p-2">
                {orders.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                    Nenhuma OS.
                  </p>
                ) : (
                  orders.map((order) => (
                    <ServiceOrderPlateCard
                      key={order.id}
                      order={order}
                      onSelect={onSelect}
                      onMove={onMove}
                      draggable={false}
                    />
                  ))
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
