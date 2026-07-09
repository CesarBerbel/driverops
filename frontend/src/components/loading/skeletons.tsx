import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Skeleton de card (usado em dashboards, blocos de resumo). */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-busy="true"
      className={cn("space-y-3 rounded-xl border p-4", className)}
    >
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

/** Skeleton de tabela/lista, com colunas e linhas configuráveis. */
export function TableSkeleton({
  rows = 5,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div
      aria-busy="true"
      role="status"
      className={cn("space-y-2", className)}
    >
      <span className="sr-only">Carregando lista...</span>
      {/* Cabeçalho */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-4 w-2/3" />
        ))}
      </div>
      {/* Linhas */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={`r-${r}`}
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={`c-${r}-${c}`} className="h-5 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}
