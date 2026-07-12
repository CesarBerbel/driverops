import { Brain, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import type { AppliedFilter } from "../types";

export function SearchAppliedFilters({
  filters,
  usedAi,
  usedSemantic,
}: {
  filters: AppliedFilter[];
  usedAi: boolean;
  usedSemantic: boolean;
}) {
  if (filters.length === 0 && !usedAi && !usedSemantic) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Filtros aplicados:</span>
      {filters.map((f) => (
        <Badge key={`${f.label}-${f.value}`} variant="outline" className="font-normal">
          <span className="text-muted-foreground">{f.label}:</span>&nbsp;{f.value}
        </Badge>
      ))}
      {usedAi && (
        <Badge variant="outline" className="gap-1 font-normal text-primary">
          <Sparkles className="size-3" /> IA
        </Badge>
      )}
      {usedSemantic && (
        <Badge variant="outline" className="gap-1 font-normal text-primary">
          <Brain className="size-3" /> Semântica
        </Badge>
      )}
    </div>
  );
}
