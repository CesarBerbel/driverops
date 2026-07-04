import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { listServicePackages } from "@/features/services/api";
import type { ServicePackage } from "@/features/services/types";
import { formatCurrencyBRL } from "@/lib/masks";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

interface PackageComboboxProps {
  // Add-to-list picker: each selection is reported via onSelect and the input
  // clears for the next pick.
  onSelect: (servicePackage: ServicePackage) => void;
  disabled?: boolean;
  invalid?: boolean;
}

export function PackageCombobox({ onSelect, disabled, invalid }: PackageComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebouncedValue(query, 300);

  const { data, isFetching } = useQuery({
    queryKey: ["service-packages", "combobox", debouncedQuery],
    queryFn: () =>
      listServicePackages({ search: debouncedQuery || undefined, status: "active" }),
    enabled: open,
  });

  const results = data ?? [];

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

  return (
    <div className="relative" ref={containerRef}>
      <Input
        placeholder="Buscar pacote pelo nome..."
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
          ) : results.length > 0 ? (
            results.map((servicePackage) => (
              <button
                key={servicePackage.id}
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  onSelect(servicePackage);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <span className="font-medium">{servicePackage.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatCurrencyBRL(Number(servicePackage.final_value))}
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              Nenhum pacote encontrado.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
