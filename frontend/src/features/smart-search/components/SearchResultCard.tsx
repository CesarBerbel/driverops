import { Car, FileText, Inbox, User, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import type { SearchEntityType, SearchResult } from "../types";

const ICONS: Record<SearchEntityType, typeof FileText> = {
  work_order: FileText,
  customer: User,
  vehicle: Car,
  lead: Inbox,
  financial: Wallet,
};

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "";
}

export function SearchResultCard({
  result,
  onSelect,
}: {
  result: SearchResult;
  onSelect: (result: SearchResult) => void;
}) {
  const Icon = ICONS[result.type] ?? FileText;
  return (
    <button
      type="button"
      onClick={() => onSelect(result)}
      className="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{result.title}</span>
          {result.status && (
            <Badge variant="muted" className="text-xs">
              {result.status}
            </Badge>
          )}
          {result.date && (
            <span className="text-xs text-muted-foreground">{fmtDate(result.date)}</span>
          )}
        </div>
        {result.subtitle && (
          <p className="truncate text-sm text-muted-foreground">{result.subtitle}</p>
        )}
        {result.snippet && (
          <p className="mt-1 line-clamp-2 text-sm">
            <span className="text-muted-foreground">“</span>
            {result.snippet}
            <span className="text-muted-foreground">”</span>
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{result.reason}</p>
      </div>
    </button>
  );
}
