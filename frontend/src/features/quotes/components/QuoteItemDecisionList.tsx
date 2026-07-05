import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatCurrencyBRL } from "@/lib/masks";
import { cn } from "@/lib/utils";

import type { QuoteItem } from "../types";

const GROUP_TITLES: Record<string, string> = {
  service: "Serviços",
  package: "Pacotes",
  part: "Peças",
};

export function approvedTotal(items: QuoteItem[], approvedIds: number[]): number {
  const set = new Set(approvedIds);
  return items
    .filter((item) => set.has(item.id))
    .reduce((sum, item) => sum + Number(item.subtotal), 0);
}

interface QuoteItemDecisionListProps {
  items: QuoteItem[];
  approvedIds: number[];
  onChange: (ids: number[]) => void;
}

// Seleção item a item (aprovado/recusado) para a aprovação parcial. Reutilizado
// no fluxo presencial (física/tablet) e na página pública. Botões grandes e
// legíveis para uso confortável em tablet.
export function QuoteItemDecisionList({
  items,
  approvedIds,
  onChange,
}: QuoteItemDecisionListProps) {
  const approved = new Set(approvedIds);

  function setApproved(id: number, value: boolean) {
    const next = new Set(approved);
    if (value) next.add(id);
    else next.delete(id);
    onChange([...next]);
  }

  const groups = (["service", "package", "part"] as const)
    .map((kind) => ({ kind, items: items.filter((i) => i.kind === kind) }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Itens do orçamento</p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onChange(items.map((i) => i.id))}
          >
            Aprovar todos
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onChange([])}
          >
            Recusar todos
          </Button>
        </div>
      </div>

      {groups.map((group) => (
        <div key={group.kind} className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            {GROUP_TITLES[group.kind]}
          </p>
          {group.items.map((item) => {
            const isApproved = approved.has(item.id);
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-md border p-2.5"
              >
                <div className="min-w-0">
                  <p
                    className={cn(
                      "truncate text-sm font-medium",
                      !isApproved && "text-muted-foreground line-through",
                    )}
                  >
                    {item.description}
                    {item.is_custom && (
                      <span className="ml-1 text-[10px] uppercase text-muted-foreground no-underline">
                        avulso
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.quantity}× · {formatCurrencyBRL(Number(item.subtotal))}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={isApproved ? "default" : "outline"}
                    aria-pressed={isApproved}
                    aria-label={`Aprovar ${item.description}`}
                    onClick={() => setApproved(item.id, true)}
                  >
                    <Check className="size-4" />
                    Aprovar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={!isApproved ? "destructive" : "outline"}
                    aria-pressed={!isApproved}
                    aria-label={`Recusar ${item.description}`}
                    onClick={() => setApproved(item.id, false)}
                  >
                    <X className="size-4" />
                    Recusar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
