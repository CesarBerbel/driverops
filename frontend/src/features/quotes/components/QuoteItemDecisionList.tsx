import { Check, Link2, Lock, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrencyBRL } from "@/lib/masks";
import { cn } from "@/lib/utils";

import type { QuoteItem } from "../types";

const REQUIRED_TOOLTIP =
  "Peça obrigatória vinculada ao serviço aprovado. Para recusá-la, recuse também o serviço.";

interface QuoteItemDecisionListProps {
  items: QuoteItem[];
  approvedIds: number[];
  onChange: (ids: number[]) => void;
}

// Seleção item a item (aprovado/recusado) para a aprovação parcial. Reutilizado
// no fluxo presencial (física/tablet) e na página pública.
//
// Regras das peças vinculadas a um serviço:
// - Serviço recusado -> todas as peças acompanham a recusa.
// - Serviço aprovado + peça OBRIGATÓRIA -> travada, aprovada junto (cadeado).
// - Serviço aprovado + peça OPCIONAL -> pode ser aprovada/recusada individualmente.
// O backend é a fonte da verdade; a UI apenas espelha as regras.
export function QuoteItemDecisionList({
  items,
  approvedIds,
  onChange,
}: QuoteItemDecisionListProps) {
  const approved = new Set(approvedIds);

  const services = items.filter((i) => i.kind === "service");
  const packages = items.filter((i) => i.kind === "package");
  const parts = items.filter((i) => i.kind === "part");
  const linkedByService = new Map<number, QuoteItem[]>();
  for (const part of parts) {
    if (part.linked_service != null) {
      const list = linkedByService.get(part.linked_service) ?? [];
      list.push(part);
      linkedByService.set(part.linked_service, list);
    }
  }
  const independentParts = parts.filter((p) => p.linked_service == null);

  // Aprovar o serviço traz junto suas peças (obrigatórias e opcionais);
  // recusar remove o serviço e todas as peças vinculadas.
  function setGroupApproved(service: QuoteItem, value: boolean) {
    const groupIds = [
      service.id,
      ...(linkedByService.get(service.id) ?? []).map((p) => p.id),
    ];
    const next = new Set(approved);
    for (const id of groupIds) {
      if (value) next.add(id);
      else next.delete(id);
    }
    onChange([...next]);
  }

  function setApproved(id: number, value: boolean) {
    const next = new Set(approved);
    if (value) next.add(id);
    else next.delete(id);
    onChange([...next]);
  }

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
          <Button type="button" size="sm" variant="outline" onClick={() => onChange([])}>
            Recusar todos
          </Button>
        </div>
      </div>

      {services.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Serviços</p>
          {services.map((service) => {
            const isApproved = approved.has(service.id);
            const linked = linkedByService.get(service.id) ?? [];
            return (
              <div key={service.id} className="rounded-md border">
                <ItemRow
                  item={service}
                  isApproved={isApproved}
                  onApprove={() => setGroupApproved(service, true)}
                  onReject={() => setGroupApproved(service, false)}
                />
                {linked.map((part) => (
                  <LinkedPartRow
                    key={part.id}
                    part={part}
                    serviceApproved={isApproved}
                    partApproved={isApproved && approved.has(part.id)}
                    onToggle={(value) => setApproved(part.id, value)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {packages.length > 0 && (
        <ItemGroup title="Pacotes" items={packages} approved={approved} onSet={setApproved} />
      )}

      {independentParts.length > 0 && (
        <ItemGroup
          title="Peças avulsas"
          items={independentParts}
          approved={approved}
          onSet={setApproved}
        />
      )}
    </div>
  );
}

function PartBadges({ part }: { part: QuoteItem }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {part.part_source_display && (
        <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
          {part.part_source_display}
        </Badge>
      )}
      {part.requirement_display && (
        <Badge
          variant="outline"
          className={cn(
            "px-1.5 py-0 text-[10px] font-normal",
            part.is_required
              ? "border-amber-400 text-amber-700 dark:text-amber-400"
              : "border-slate-300 text-muted-foreground",
          )}
        >
          {part.requirement_display}
        </Badge>
      )}
    </span>
  );
}

function LinkedPartRow({
  part,
  serviceApproved,
  partApproved,
  onToggle,
}: {
  part: QuoteItem;
  serviceApproved: boolean;
  partApproved: boolean;
  onToggle: (value: boolean) => void;
}) {
  // Peça obrigatória de serviço aprovado é travada; opcional é decidível.
  const locked = !serviceApproved || part.is_required;
  return (
    <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-2.5 py-2 pl-6">
      <div className="min-w-0 space-y-0.5">
        <p
          className={cn(
            "flex items-center gap-1 truncate text-sm",
            !partApproved && "text-muted-foreground line-through",
          )}
        >
          {part.is_required ? (
            <Lock className="size-3 shrink-0 text-muted-foreground" />
          ) : (
            <Link2 className="size-3 shrink-0 text-muted-foreground" />
          )}
          {part.description}
        </p>
        <PartBadges part={part} />
        <p className="text-xs text-muted-foreground">
          {part.quantity}× · {formatCurrencyBRL(Number(part.subtotal))}
        </p>
      </div>
      {serviceApproved && !part.is_required ? (
        // Opcional de serviço aprovado: checkbox individual.
        <label className="flex shrink-0 items-center gap-1.5 text-xs">
          <Checkbox
            checked={partApproved}
            onCheckedChange={(v) => onToggle(v === true)}
            aria-label={`Aprovar ${part.description}`}
          />
          {partApproved ? "Aprovada" : "Recusada"}
        </label>
      ) : (
        <span
          className={cn(
            "flex shrink-0 items-center gap-1 text-xs font-medium",
            partApproved ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
          )}
          title={locked && part.is_required ? REQUIRED_TOOLTIP : undefined}
        >
          {locked && part.is_required && serviceApproved && <Lock className="size-3" />}
          {partApproved ? "Aprovada" : "Recusada"}
        </span>
      )}
    </div>
  );
}

function ItemGroup({
  title,
  items,
  approved,
  onSet,
}: {
  title: string;
  items: QuoteItem[];
  approved: Set<number>;
  onSet: (id: number, value: boolean) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      {items.map((item) => (
        <div key={item.id} className="rounded-md border">
          <ItemRow
            item={item}
            isApproved={approved.has(item.id)}
            onApprove={() => onSet(item.id, true)}
            onReject={() => onSet(item.id, false)}
          />
        </div>
      ))}
    </div>
  );
}

function ItemRow({
  item,
  isApproved,
  onApprove,
  onReject,
}: {
  item: QuoteItem;
  isApproved: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-2.5">
      <div className="min-w-0">
        <p
          className={cn(
            "truncate text-sm font-medium",
            !isApproved && "text-muted-foreground line-through",
          )}
        >
          {item.description}
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
          onClick={onApprove}
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
          onClick={onReject}
        >
          <X className="size-4" />
          Recusar
        </Button>
      </div>
    </div>
  );
}
