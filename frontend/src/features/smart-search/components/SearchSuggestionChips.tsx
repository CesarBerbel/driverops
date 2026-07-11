import { Clock, Search } from "lucide-react";

export function SearchSuggestionChips({
  starters,
  recent,
  onPick,
}: {
  starters: string[];
  recent: string[];
  onPick: (query: string) => void;
}) {
  return (
    <div className="space-y-4">
      {recent.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Buscas recentes
          </p>
          <div className="flex flex-col gap-1">
            {recent.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onPick(q)}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Clock className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{q}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Sugestões
        </p>
        <div className="flex flex-wrap gap-2">
          {starters.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onPick(q)}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Search className="size-3.5" />
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
