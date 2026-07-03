import { Car } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { formatPlateForDisplay } from "./plate";
import type { Vehicle } from "./types";

interface VehicleSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicles: Vehicle[];
  onSelect: (vehicle: Vehicle) => void;
}

export function VehicleSelectorDialog({
  open,
  onOpenChange,
  vehicles,
  onSelect,
}: VehicleSelectorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Selecione um veículo</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          {vehicles.map((vehicle) => (
            <button
              key={vehicle.id}
              type="button"
              className="flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm hover:bg-accent"
              onClick={() => onSelect(vehicle)}
            >
              <Car className="size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium">{formatPlateForDisplay(vehicle.license_plate)}</p>
                <p className="text-xs text-muted-foreground">
                  {[vehicle.brand, vehicle.model].filter(Boolean).join(" ") || "Sem marca/modelo"}
                </p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
