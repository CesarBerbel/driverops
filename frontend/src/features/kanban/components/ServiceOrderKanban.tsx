import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { OSQuickViewModal } from "@/features/dashboard/components/OSQuickViewModal";
import { moveWorkOrder } from "@/features/orders/api";
import { statusLabel } from "@/features/orders/constants";
import type { OrderStatus, WorkOrder } from "@/features/orders/types";
import { extractErrorMessage } from "@/lib/api-client";
import { useMediaQuery } from "@/lib/useMediaQuery";

import { ServiceOrderKanbanAccordion } from "./ServiceOrderKanbanAccordion";
import { ServiceOrderKanbanColumn } from "./ServiceOrderKanbanColumn";

interface ServiceOrderKanbanProps {
  orders: WorkOrder[];
  // Visible column statuses, already in display order.
  columns: OrderStatus[];
  // Active work-orders query key, so optimistic updates hit the right cache.
  queryKey: unknown[];
}

export function ServiceOrderKanban({ orders, columns, queryKey }: ServiceOrderKanbanProps) {
  const queryClient = useQueryClient();
  // Below lg the board becomes a stacked accordion (no touch drag-and-drop).
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [draggingOrder, setDraggingOrder] = useState<WorkOrder | null>(null);
  const [selected, setSelected] = useState<WorkOrder | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const moveMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: OrderStatus }) =>
      moveWorkOrder(id, status),
    // Optimistic: move the card immediately, roll back if the backend rejects.
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WorkOrder[]>(queryKey);
      queryClient.setQueryData<WorkOrder[]>(queryKey, (old) =>
        (old ?? []).map((o) =>
          o.id === id
            ? { ...o, status, status_display: statusLabel(status) }
            : o,
        ),
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast.error(
        extractErrorMessage(error, "Não foi possível mover a OS."),
        { id: "kanban-move" },
      );
    },
    onSuccess: (updated) => {
      // Replace the optimistic row with the server truth (status_display, etc.).
      queryClient.setQueryData<WorkOrder[]>(queryKey, (old) =>
        (old ?? []).map((o) => (o.id === updated.id ? updated : o)),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  function move(order: WorkOrder, status: OrderStatus) {
    if (order.status === status) return;
    moveMutation.mutate({ id: order.id, status });
  }

  function handleDrop(status: OrderStatus) {
    const order = draggingOrder;
    setDraggingOrder(null);
    if (order) move(order, status);
  }

  function openModal(order: WorkOrder) {
    setSelected(order);
    setModalOpen(true);
  }

  const byStatus = (status: OrderStatus) => orders.filter((o) => o.status === status);

  return (
    <>
      {isDesktop ? (
        <div className="flex h-full min-h-0 gap-3 overflow-x-auto p-4 md:px-6">
          {columns.map((status) => (
            <ServiceOrderKanbanColumn
              key={status}
              status={status}
              orders={byStatus(status)}
              draggingOrder={draggingOrder}
              onSelect={openModal}
              onMove={move}
              onDragStart={setDraggingOrder}
              onDragEnd={() => setDraggingOrder(null)}
              onDrop={handleDrop}
            />
          ))}
        </div>
      ) : (
        <ServiceOrderKanbanAccordion
          columns={columns}
          ordersByStatus={byStatus}
          onSelect={openModal}
          onMove={move}
        />
      )}

      <OSQuickViewModal order={selected} open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
