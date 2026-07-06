import { useSearchParams } from "react-router-dom";

import { cn } from "@/lib/utils";

import { useSwipeNavigation } from "@/lib/useSwipeNavigation";
import { DashboardAdministrativoView } from "./DashboardAdministrativoView";
import { DashboardOSView } from "./DashboardOSView";
import { DashboardOperacionalView } from "./DashboardOperacionalView";

const TABS = [
  { key: "operacional", label: "Operacional" },
  { key: "os", label: "OS" },
  { key: "administrativo", label: "Administrativo" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function isTabKey(value: string | null): value is TabKey {
  return TABS.some((tab) => tab.key === value);
}

export function DashboardTabs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get("tab");
  const active: TabKey = isTabKey(param) ? param : "operacional";
  const activeIndex = TABS.findIndex((tab) => tab.key === active);

  function selectTab(key: TabKey) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", key);
        return next;
      },
      { replace: true },
    );
  }

  function goTo(index: number) {
    const clamped = Math.max(0, Math.min(TABS.length - 1, index));
    if (clamped !== activeIndex) selectTab(TABS[clamped].key);
  }

  const swipe = useSwipeNavigation({
    onNext: () => goTo(activeIndex + 1),
    onPrev: () => goTo(activeIndex - 1),
  });

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Visões do Dashboard"
        className="flex w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1 sm:w-auto"
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active === tab.key}
            onClick={() => selectTab(tab.key)}
            className={cn(
              "flex-1 whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium transition-colors sm:flex-none",
              active === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Área com suporte a swipe horizontal (toque). Não usa preventDefault,
          então a rolagem vertical e os cliques continuam funcionando. */}
      <div role="tabpanel" onTouchStart={swipe.onTouchStart} onTouchEnd={swipe.onTouchEnd}>
        {active === "operacional" && <DashboardOperacionalView />}
        {active === "os" && <DashboardOSView />}
        {active === "administrativo" && <DashboardAdministrativoView />}
      </div>
    </div>
  );
}
