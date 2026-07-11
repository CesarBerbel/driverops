import { LayoutDashboard, Menu, Plus } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

import { usePermissionCheck } from "@/features/auth/usePermission";
import { cn } from "@/lib/utils";

import { MobileMoreMenu } from "./MobileMoreMenu";

const itemClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium",
    isActive ? "text-primary" : "text-muted-foreground",
  );

// Barra de navegação inferior fixa do mobile: Dashboard, Nova OS (destacada,
// central) e Mais. Só aparece abaixo de `lg` (o AppShell a envolve em lg:hidden).
export function MobileBottomNav() {
  const can = usePermissionCheck();
  const canCreateOrder = can("orders.create");
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  // "Mais" fica destacado quando a rota atual não é o Dashboard (os demais
  // módulos são acessados por ele).
  const moreActive = !location.pathname.startsWith("/dashboard");

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <div className="mx-auto flex h-14 max-w-lg items-stretch">
          <NavLink to="/dashboard" className={itemClass} aria-label="Dashboard">
            <LayoutDashboard className="size-5" />
            <span>Início</span>
          </NavLink>

          {/* Ação principal: Nova OS, destacada e elevada. Só com permissão. */}
          {canCreateOrder ? (
            <div className="flex w-20 shrink-0 justify-center">
              <Link
                to="/orders/new"
                aria-label="Nova OS"
                className="-mt-5 flex size-14 flex-col items-center justify-center gap-0.5 rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background transition-transform active:scale-95"
              >
                <Plus className="size-6" />
                <span className="text-[9px] font-semibold leading-none">Nova OS</span>
              </Link>
            </div>
          ) : (
            <div className="w-4 shrink-0" />
          )}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="Mais módulos"
            aria-haspopup="dialog"
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium",
              moreActive ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Menu className="size-5" />
            <span>Mais</span>
          </button>
        </div>
      </nav>

      <MobileMoreMenu open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
}
