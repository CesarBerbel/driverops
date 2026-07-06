import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

import { useSwipeNavigation } from "@/lib/useSwipeNavigation";
import { cn } from "@/lib/utils";

export interface ServiceOrderTabDef {
  key: string;
  label: string;
  // Indicador visual de erro na aba (campos obrigatórios inválidos).
  hasError?: boolean;
  // Abas que dependem de uma OS já salva (Fotos, Orçamento, Histórico).
  disabled?: boolean;
  disabledHint?: string;
}

interface ServiceOrderTabsProps {
  tabs: ServiceOrderTabDef[];
  active: string;
  onChange: (key: string) => void;
  children: ReactNode;
}

// Barra de abas da OS: rolagem horizontal no mobile/tablet, swipe por toque e
// indicador de erro por aba. Os botões são type="button" para nunca submeterem
// o formulário ao trocar de aba.
export function ServiceOrderTabs({ tabs, active, onChange, children }: ServiceOrderTabsProps) {
  const enabled = tabs.filter((tab) => !tab.disabled);
  const activeIndex = enabled.findIndex((tab) => tab.key === active);

  function goTo(index: number) {
    const clamped = Math.max(0, Math.min(enabled.length - 1, index));
    const target = enabled[clamped];
    if (target && target.key !== active) onChange(target.key);
  }

  const swipe = useSwipeNavigation({
    onNext: () => goTo(activeIndex + 1),
    onPrev: () => goTo(activeIndex - 1),
  });

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Seções da Ordem de Serviço"
        className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1"
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active === tab.key}
            disabled={tab.disabled}
            title={tab.disabled ? tab.disabledHint : undefined}
            onClick={() => !tab.disabled && onChange(tab.key)}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
              tab.disabled && "cursor-not-allowed opacity-50 hover:text-muted-foreground",
            )}
          >
            {tab.label}
            {tab.hasError && (
              <AlertCircle
                className="size-3.5 text-destructive"
                aria-label="Contém erros"
              />
            )}
          </button>
        ))}
      </div>

      <div role="tabpanel" onTouchStart={swipe.onTouchStart} onTouchEnd={swipe.onTouchEnd}>
        {children}
      </div>
    </div>
  );
}
