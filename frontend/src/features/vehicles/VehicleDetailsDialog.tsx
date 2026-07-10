import { useQuery } from "@tanstack/react-query";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatQuantityBRL } from "@/lib/masks";

import { getVehicle } from "./api";
import {
  FUEL_TYPE_OPTIONS,
  STEERING_OPTIONS,
  TRANSMISSION_OPTIONS,
  USAGE_CATEGORY_OPTIONS,
  VEHICLE_TYPE_OPTIONS,
} from "./constants";
import { formatPlateForDisplay } from "./plate";

function label(options: { value: string; label: string }[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? "";
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

/** Modal somente leitura com os dados do veículo (aberto pela OS/outras telas). */
export function VehicleDetailsDialog({
  open,
  onOpenChange,
  vehicleId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: number | null;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["vehicle", vehicleId],
    queryFn: () => getVehicle(vehicleId as number),
    enabled: open && vehicleId != null,
  });

  const years =
    data && (data.manufacture_year || data.model_year)
      ? [data.manufacture_year, data.model_year].filter(Boolean).join("/")
      : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Dados do veículo</DialogTitle>
          <DialogDescription>
            {data ? formatPlateForDisplay(data.license_plate) : "Detalhes do veículo da OS."}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !data ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Placa" value={formatPlateForDisplay(data.license_plate)} />
            <Field
              label="Marca / Modelo"
              value={[data.brand, data.model].filter(Boolean).join(" ")}
            />
            <Field label="Versão" value={data.version} />
            <Field label="Ano (fab./modelo)" value={years} />
            <Field label="Cor" value={data.color} />
            <Field
              label="Quilometragem"
              value={data.mileage != null ? `${formatQuantityBRL(data.mileage)} km` : ""}
            />
            <Field label="Combustível" value={label(FUEL_TYPE_OPTIONS, data.fuel_type)} />
            <Field label="Câmbio" value={label(TRANSMISSION_OPTIONS, data.transmission)} />
            <Field label="Direção" value={label(STEERING_OPTIONS, data.steering)} />
            <Field label="Portas" value={data.doors != null ? String(data.doors) : ""} />
            <Field
              label="Ar-condicionado"
              value={
                data.air_conditioning == null ? "" : data.air_conditioning ? "Sim" : "Não"
              }
            />
            <Field label="Tipo" value={label(VEHICLE_TYPE_OPTIONS, data.vehicle_type)} />
            <Field
              label="Categoria de uso"
              value={label(USAGE_CATEGORY_OPTIONS, data.usage_category)}
            />
            <Field label="Chassi" value={data.chassis} />
            <Field label="Renavam" value={data.renavam} />
            <Field label="Código FIPE" value={data.fipe_code} />
            {data.notes && (
              <div className="col-span-2 space-y-0.5">
                <p className="text-xs text-muted-foreground">Observações</p>
                <p className="text-sm">{data.notes}</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
