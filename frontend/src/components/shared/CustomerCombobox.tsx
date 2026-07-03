import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { listCustomers } from "@/features/customers/api";
import type { Customer } from "@/features/customers/types";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

interface CustomerComboboxProps {
  selectedName: string;
  onSelect: (customer: Customer) => void;
  onClear: () => void;
  disabled?: boolean;
  invalid?: boolean;
}

export function CustomerCombobox({
  selectedName,
  onSelect,
  onClear,
  disabled,
  invalid,
}: CustomerComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebouncedValue(query, 300);

  const { data: results, isFetching } = useQuery({
    queryKey: ["customers", "combobox", debouncedQuery],
    queryFn: () => listCustomers(debouncedQuery || undefined),
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

  if (selectedName) {
    return (
      <div className="flex items-center justify-between rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
        <span className="font-medium">{selectedName}</span>
        {!disabled && (
          <button
            type="button"
            onClick={onClear}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Trocar cliente"
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
        placeholder="Buscar cliente pelo nome..."
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
            results.map((customer) => (
              <button
                key={customer.id}
                type="button"
                className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  onSelect(customer);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <span className="font-medium">{customer.name}</span>
                {customer.document && (
                  <span className="text-xs text-muted-foreground">{customer.document}</span>
                )}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
          )}
        </div>
      )}
    </div>
  );
}
