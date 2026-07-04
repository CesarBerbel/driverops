import { AlertTriangle, Car } from "lucide-react";

import { ContactLink } from "@/components/shared/ContactLink";
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
    <button
      type="button"
      onClick={() => onSelect(order)}
      aria-label={`Ordem de serviço ${formatOrderNumber(order.number)}`}
      className={cn(
        "group relative mb-3 block w-full rounded-xl border bg-card p-4 pb-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
        overdue && "border-destructive/60",
      )}
    >
      {/* marca d'água de carro */}
      <Car className="pointer-events-none absolute right-3 top-3 size-16 text-muted-foreground/10" />

      <div className="relative flex items-start justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">
          {formatOrderNumber(order.number)}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            statusPillClass(order.status),
          )}
        >
          {order.status_display}
        </span>
      </div>

      {/* Placa -- elemento mais destacado */}
      <div className="relative mx-auto mt-3 w-full max-w-[190px] overflow-hidden rounded-md border-2 border-slate-800 bg-white shadow-sm">
        <div className="bg-blue-700 px-2 py-0.5 text-center text-[8px] font-bold tracking-[0.3em] text-white">
          BRASIL
        </div>
        <div className="px-2 py-1 text-center font-mono text-2xl font-extrabold tracking-[0.2em] text-slate-900">
          {formatPlateForDisplay(order.vehicle_plate)}
        </div>
      </div>

      <p className="relative mt-3 text-center text-sm font-medium">{vehicleDesc}</p>

      <div className="relative mt-3 space-y-0.5">
        <p className="text-sm font-medium">{order.customer_name}</p>
        <ContactLink
          whatsapp={order.customer_whatsapp}
          phone={order.customer_phone}
          className="text-xs"
        />
      </div>

      <div className="relative mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>Abertura: {formatBrDate(order.opened_at)}</span>
        <span className={cn(overdue && "font-medium text-destructive")}>
          Previsão: {formatBrDate(order.expected_delivery)}
        </span>
        <span className="col-span-2 font-medium text-foreground">
          {formatCurrencyBRL(Number(order.final_value))}
        </span>
      </div>

      {overdue && (
        <span className="relative mt-2 inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
          <AlertTriangle className="size-3" />
          Atrasada
        </span>
      )}

      {/* "rodas" na base para reforçar a identidade de carro */}
      <span className="absolute bottom-1 left-6 size-3 rounded-full border-2 border-slate-500 bg-slate-800" />
      <span className="absolute bottom-1 right-6 size-3 rounded-full border-2 border-slate-500 bg-slate-800" />
    </button>
  );
}
