import { Search } from "lucide-react";

import { useSmartSearch } from "./smart-search-context";

// Botão de busca para o header desktop (com dica do atalho ⌘K/Ctrl+K).
export function SmartSearchTrigger() {
  const { open } = useSmartSearch();
  return (
    <button
      type="button"
      onClick={open}
      aria-label="Abrir busca inteligente"
      className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <Search className="size-4" />
      <span className="hidden md:inline">Buscar...</span>
      <kbd className="hidden rounded border bg-muted px-1.5 font-mono text-[10px] md:inline">
        Ctrl K
      </kbd>
    </button>
  );
}

// Ícone compacto para o header mobile.
export function SmartSearchIconTrigger() {
  const { open } = useSmartSearch();
  return (
    <button
      type="button"
      onClick={open}
      aria-label="Abrir busca inteligente"
      className="inline-flex size-10 items-center justify-center rounded-md text-foreground hover:bg-accent"
    >
      <Search className="size-5" />
    </button>
  );
}
