import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatOrderNumber } from "@/features/orders/lib/orderMapping";
import type { WorkOrder } from "@/features/orders/types";

import { OrderPaymentsPanel } from "./OrderPaymentsPanel";

export function RegisterPaymentDialog({
  order,
  open,
  onOpenChange,
}: {
  order: WorkOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b p-5">
          <DialogTitle>{formatOrderNumber(order.number)}</DialogTitle>
          <DialogDescription>
            {order.customer_name} · {order.vehicle_plate}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-5">
          <OrderPaymentsPanel order={order} enabled={open} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
