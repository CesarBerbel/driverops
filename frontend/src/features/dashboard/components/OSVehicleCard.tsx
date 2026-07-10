import { AlertTriangle, Car } from "lucide-react";

import { ContactLink } from "@/components/shared/ContactLink";
import { CustomerLink } from "@/components/shared/CustomerLink";
import { OrderPdfButton } from "@/features/orders/components/OrderPdfButton";
import { formatPlateForDisplay } from "@/features/vehicles/plate";
import type { WorkOrder } from "@/features/orders/types";
import { formatCurrencyBRL } from "@/lib/masks";
import { cn } from "@/lib/utils";

import { formatBrDate, isOverdue, statusPillClass } from "../osStatus";
import { formatOrderNumber } from "@/features/orders/lib/orderMapping";

interface OSVehicleCardProps {
  order: WorkOrder;
  onSelect: (order: WorkOrder) => void;
}

// Card com identidade visual de veículo: uma placa (padrão Mercosul) como
// elemento mais destacado, ícone de carro como marca d'água e "rodas" na base.
export function OSVehicleCard({ order, onSelect }: OSVehicleCardProps) {
  const overdue = isOverdue(order);
  const vehicleDesc = order.vehicle_description || "Sem marca/modelo";

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => onSelect(order)}
        aria-label={`Ordem de serviço ${formatOrderNumber(order.number)}`}
        className={cn(
          "block w-full rounded-xl border bg-card p-3 pb-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
          overdue && "border-destructive/60",
        )}
      >
        {/* marca d'água de carro */}
        <Car className="pointer-events-none absolute right-2 top-2 size-11 text-muted-foreground/10" />

        <div className="relative flex items-start justify-between gap-2 pl-7">
          <span className="text-[11px] font-semibold text-muted-foreground">
            {formatOrderNumber(order.number)}
          </span>
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
              statusPillClass(order.status),
            )}
          >
            {order.status_display}
          </span>
        </div>

        {/* Placa -- elemento mais destacado */}
        <div className="relative mx-auto mt-2 w-full max-w-[150px] overflow-hidden rounded-md border-2 border-slate-800 bg-white shadow-sm">
          <div className="bg-blue-700 px-2 py-px text-center text-[7px] font-bold tracking-[0.25em] text-white">
            BRASIL
          </div>
          <div className="px-2 py-0.5 text-center font-mono text-lg font-extrabold tracking-[0.15em] text-slate-900">
            {formatPlateForDisplay(order.vehicle_plate)}
          </div>
        </div>

        <p className="relative mt-2 truncate text-center text-xs font-medium">{vehicleDesc}</p>

        <div className="relative mt-2 space-y-0.5">
          <p className="truncate text-sm font-medium">
            <CustomerLink id={order.customer} name={order.customer_name} />
          </p>
          <ContactLink
            whatsapp={order.customer_whatsapp}
            phone={order.customer_phone}
            className="text-xs"
          />
        </div>

        <div className="relative mt-2 space-y-0.5 text-[11px] text-muted-foreground">
          <div className="flex items-center justify-between gap-2">
            <span>Abertura: {formatBrDate(order.opened_at)}</span>
            <span className={cn(overdue && "font-medium text-destructive")}>
              Previsão: {formatBrDate(order.expected_delivery)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-foreground">
              {formatCurrencyBRL(Number(order.final_value))}
            </span>
            {overdue && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                <AlertTriangle className="size-3" />
                Atrasada
              </span>
            )}
          </div>
        </div>

        {/* "rodas" na base para reforçar a identidade de carro */}
        <span className="absolute bottom-1 left-5 size-2.5 rounded-full border-2 border-slate-500 bg-slate-800" />
        <span className="absolute bottom-1 right-5 size-2.5 rounded-full border-2 border-slate-500 bg-slate-800" />
      </button>

      {/* Gerar PDF -- irmão do botão do card (não aninhado) para HTML válido. */}
      <OrderPdfButton
        orderId={order.id}
        iconOnly
        variant="ghost"
        stopPropagation
        className="absolute left-1 top-1 z-10 size-7 text-muted-foreground hover:text-foreground"
      />
    </div>
  );
}
