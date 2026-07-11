import { AlertCircle } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";

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

  // Mantém o título da aba ativa visível na barra (que rola no mobile) conforme
  // o usuário troca de aba deslizando o dedo.
  const activeTabRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [active]);

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Seções da Ordem de Serviço"
        className="flex gap-1 overflow-x-auto scrollbar-none rounded-lg bg-muted p-1"
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            ref={active === tab.key ? activeTabRef : undefined}
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

      {/* Área com swipe horizontal (toque): deslizar para o lado troca a aba
          inteira. touch-pan-y deixa a rolagem vertical nativa, mas entrega o
          gesto horizontal para o nosso handler (o navegador não o sequestra). */}
      <div
        role="tabpanel"
        className="touch-pan-y"
        onTouchStart={swipe.onTouchStart}
        onTouchMove={swipe.onTouchMove}
        onTouchEnd={swipe.onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
