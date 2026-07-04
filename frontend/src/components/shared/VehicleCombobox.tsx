import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { listVehicles } from "@/features/vehicles/api";
import { formatPlateForDisplay } from "@/features/vehicles/plate";
import type { Vehicle } from "@/features/vehicles/types";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

interface VehicleComboboxProps {
  // Single-select picker keyed on the license plate (the OS's primary
  // operational identifier). Accepts plate with or without hyphen and in any
  // case -- the backend search matches the normalized stored value.
  selectedLabel: string;
  onSelect: (vehicle: Vehicle) => void;
  onClear: () => void;
  // When set, only vehicles of this customer are offered.
  customerId?: number | null;
  disabled?: boolean;
  invalid?: boolean;
}

export function VehicleCombobox({
  selectedLabel,
  onSelect,
  onClear,
  customerId,
  disabled,
  invalid,
}: VehicleComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebouncedValue(query, 300);

  const { data: results, isFetching } = useQuery({
    queryKey: ["vehicles", "combobox", debouncedQuery, customerId ?? null],
    queryFn: () =>
      listVehicles({
        search: debouncedQuery || undefined,
        status: "active",
        customerId: customerId ?? undefined,
      }),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (selectedLabel) {
    return (
      <div className="flex items-center justify-between rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
        <span className="font-medium">{selectedLabel}</span>
        {!disabled && (
          <button
            type="button"
            onClick={onClear}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Trocar veículo"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <Input
        placeholder="Buscar veículo pela placa..."
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        disabled={disabled}
        aria-invalid={invalid}
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover shadow-md">
          {isFetching ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Buscando...</p>
          ) : results && results.length > 0 ? (
            results.map((vehicle) => (
              <button
                key={vehicle.id}
                type="button"
                className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  onSelect(vehicle);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <span className="font-medium">
                  {formatPlateForDisplay(vehicle.license_plate)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {[
                    [vehicle.brand, vehicle.model].filter(Boolean).join(" "),
                    vehicle.customer_name,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Sem marca/modelo"}
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              Nenhum veículo encontrado.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
