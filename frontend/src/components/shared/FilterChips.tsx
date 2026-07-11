import { X } from "lucide-react";

export interface FilterChip {
  label: string;
  onRemove: () => void;
}

// Chips dos filtros ativos, cada um removível ao toque, com um "Limpar" opcional.
// Não renderiza nada quando não há filtro ativo.
export function FilterChips({
  chips,
  onClearAll,
}: {
  chips: FilterChip[];
  onClearAll?: () => void;
}) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip, index) => (
        <button
          key={`${chip.label}-${index}`}
          type="button"
          onClick={chip.onRemove}
          className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
          aria-label={`Remover filtro ${chip.label}`}
        >
          {chip.label}
          <X className="size-3" />
        </button>
      ))}
      {onClearAll && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs text-muted-foreground underline underline-offset-2"
        >
          Limpar
        </button>
      )}
    </div>
  );
}
