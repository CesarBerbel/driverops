import { Gauge, Palette, Plus, User } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Can } from "@/features/auth/Can";

import { formatPlateForDisplay } from "../plate";
import type { Vehicle } from "../types";

// Card mobile do veículo: espelha o padrão da OS. A abertura (edição/detalhe) é
// por sheet na página, então o card recebe `onOpen` e delega para a página.
export function VehicleMobileCard({
  vehicle,
  onOpen,
}: {
  vehicle: Vehicle;
  onOpen?: () => void;
}) {
  const brandModel =
    [vehicle.brand, vehicle.model].filter(Boolean).join(" ") || "—";

  return (
    <Card>
      <CardContent className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          {onOpen ? (
            <button
              type="button"
              onClick={onOpen}
              className="text-sm font-semibold text-primary hover:underline focus-visible:underline focus-visible:outline-none"
            >
              {formatPlateForDisplay(vehicle.license_plate)}
            </button>
          ) : (
            <span className="text-sm font-semibold text-primary">
              {formatPlateForDisplay(vehicle.license_plate)}
            </span>
          )}
        </div>

        <p className="text-sm leading-snug">
          <span className="font-medium">{brandModel}</span>
          {vehicle.version && (
            <span className="text-muted-foreground"> {vehicle.version}</span>
          )}
        </p>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <User className="size-3" />
            {vehicle.customer_name}
          </span>
          {vehicle.mileage != null && (
            <span className="inline-flex items-center gap-1">
              <Gauge className="size-3" />
              {vehicle.mileage.toLocaleString("pt-BR")} km
            </span>
          )}
          {vehicle.color && (
            <span className="inline-flex items-center gap-1">
              <Palette className="size-3" />
              {vehicle.color}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 pt-1">
          <Button size="sm" className="flex-1" onClick={onOpen}>
            Ver veículo
          </Button>
          <Can code="orders.create">
            <Button asChild size="sm" variant="outline" title="Nova OS" aria-label="Nova OS">
              <Link to="/orders/new">
                <Plus className="size-4" />
                <span className="sr-only">Nova OS</span>
              </Link>
            </Button>
          </Can>
        </div>
      </CardContent>
    </Card>
  );
}
