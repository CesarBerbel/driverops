import { Outlet } from "react-router-dom";

import { SmartSearchProvider } from "@/features/smart-search/SmartSearchProvider";

import { MobileBottomNav } from "./mobile/MobileBottomNav";
import { MobileHeader } from "./mobile/MobileHeader";
import { Topbar } from "./Topbar";

export function AppShell() {
  return (
    <SmartSearchProvider>
      <div className="flex min-h-svh flex-col bg-muted/30">
        {/* Desktop/tablet grande (>= lg): menu completo no topo. */}
        <div className="hidden lg:block">
          <Topbar />
        </div>
        {/* Mobile/tablet pequeno (< lg): header compacto + navegação inferior. */}
        <MobileHeader />

        <main className="flex-1 p-4 pb-24 md:p-6 lg:pb-6">
          <Outlet />
        </main>

        <MobileBottomNav />
      </div>
    </SmartSearchProvider>
  );
}
