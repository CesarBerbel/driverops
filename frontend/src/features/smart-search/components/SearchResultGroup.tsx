import type { SearchGroup, SearchResult } from "../types";
import { SearchResultCard } from "./SearchResultCard";

export function SearchResultGroup({
  group,
  onSelect,
}: {
  group: SearchGroup;
  onSelect: (result: SearchResult) => void;
}) {
  return (
    <section className="space-y-2">
      <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {group.label} · {group.results.length}
      </h3>
      <div className="space-y-2">
        {group.results.map((result) => (
          <SearchResultCard key={`${result.type}-${result.id}`} result={result} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}
