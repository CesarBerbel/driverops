import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { listParts } from "@/features/parts/api";
import type { Part } from "@/features/parts/types";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

interface PartComboboxProps {
  // Add-to-list picker: each selection is reported via onSelect and the input
  // clears for the next pick. Parts already added (excludeIds) are filtered out
  // so the same part can't be linked twice.
  onSelect: (part: Part) => void;
  excludeIds?: number[];
  disabled?: boolean;
  invalid?: boolean;
}

export function PartCombobox({ onSelect, excludeIds = [], disabled, invalid }: PartComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebouncedValue(query, 300);

  const { data, isFetching } = useQuery({
    queryKey: ["parts", "combobox", debouncedQuery],
    queryFn: () => listParts({ search: debouncedQuery || undefined, status: "active" }),
    enabled: open,
  });

  const results = (data ?? []).filter((part) => !excludeIds.includes(part.id));

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
        placeholder="Buscar peça pelo nome ou código..."
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
            results.map((part) => (
              <button
                key={part.id}
                type="button"
                className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  onSelect(part);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <span className="font-medium">{part.name}</span>
                {(part.internal_code || part.category_name) && (
                  <span className="text-xs text-muted-foreground">
                    {[part.internal_code, part.category_name].filter(Boolean).join(" · ")}
                  </span>
                )}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-muted-foreground">Nenhuma peça encontrada.</p>
          )}
        </div>
      )}
    </div>
  );
}
