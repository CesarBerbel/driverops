import { ArrowRight, Car } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { ContactLink } from "@/components/shared/ContactLink";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPlateForDisplay } from "@/features/vehicles/plate";
import type {
  WorkOrder,
  WorkOrderPackageItem,
  WorkOrderPartItem,
  WorkOrderServiceItem,
} from "@/features/orders/types";
import { formatCurrencyBRL, formatQuantityBRL } from "@/lib/masks";
import { cn } from "@/lib/utils";

import { formatBrDate, statusPillClass } from "../osStatus";
import { formatOrderNumber } from "@/features/orders/lib/orderMapping";

interface OSQuickViewModalProps {
  order: WorkOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

function ItemList({
  title,
  items,
}: {
  title: string;
  items: (WorkOrderServiceItem | WorkOrderPackageItem | WorkOrderPartItem)[];
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum(a).</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item, index) => (
            <li key={index} className="flex justify-between gap-2 text-sm">
              <span className="truncate">
                {item.display_name}
                {item.is_custom && (
                  <span className="ml-1 text-[10px] uppercase text-muted-foreground">
                    avulso
                  </span>
                )}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {formatQuantityBRL(Number(item.quantity))}× ·{" "}
                {formatCurrencyBRL(Number(item.line_total))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function OSQuickViewModal({ order, open, onOpenChange }: OSQuickViewModalProps) {
  const navigate = useNavigate();

  return (
    <Dialog open={open && order !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-lg">
        {order && (
          <>
            <DialogHeader className="space-y-0 border-b p-5">
              <div className="flex items-center justify-between gap-2">
                <DialogTitle className="flex items-center gap-2">
                  <Car className="size-5 text-primary" />
                  {formatOrderNumber(order.number)}
                </DialogTitle>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    statusPillClass(order.status),
                  )}
                >
                  {order.status_display}
                </span>
              </div>
            </DialogHeader>

            <div className="space-y-5 p-5">
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Placa"
                    value={formatPlateForDisplay(order.vehicle_plate)}
                  />
                  <Field label="Veículo" value={order.vehicle_description} />
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Cliente</p>
                <p className="text-sm font-medium">{order.customer_name}</p>
                <ContactLink
                  whatsapp={order.customer_whatsapp}
                  phone={order.customer_phone}
                  className="text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Data de abertura" value={formatBrDate(order.opened_at)} />
                <Field
                  label="Previsão de entrega"
                  value={formatBrDate(order.expected_delivery)}
                />
              </div>

              <Field label="Relato do cliente" value={order.customer_report} />
              {order.diagnosis && (
                <Field label="Diagnóstico técnico" value={order.diagnosis} />
              )}

              <ItemList title="Serviços" items={order.service_items} />
              <ItemList title="Pacotes" items={order.package_items} />
              <ItemList title="Peças" items={order.part_items} />

              {order.internal_notes && (
                <Field label="Observações internas" value={order.internal_notes} />
              )}

              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-sm text-muted-foreground">Valor total</span>
                <span className="text-lg font-semibold">
                  {formatCurrencyBRL(Number(order.final_value))}
                </span>
              </div>
            </div>

            <DialogFooter className="flex-row justify-end gap-2 border-t p-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <Button onClick={() => navigate(`/orders/${order.id}`)}>
                Abrir OS
                <ArrowRight className="size-4" />
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
