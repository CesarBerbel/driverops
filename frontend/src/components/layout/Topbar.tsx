import { useQuery } from "@tanstack/react-query";
import { Inbox, KanbanSquare, LayoutDashboard, Plus, Sparkles, Truck } from "lucide-react";
import { Link, NavLink } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/features/alerts/components/NotificationBell";
import { usePermissionCheck } from "@/features/auth/usePermission";
import { getPendingCount as getCrmPending } from "@/features/crm/api";
import { getLeadsPendingCount } from "@/features/leads/api";
import { cn } from "@/lib/utils";

import { UserMenu } from "./UserMenu";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
    isActive
      ? "bg-secondary text-secondary-foreground"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  );

export function Topbar() {
  const can = usePermissionCheck();
  const canLeads = can("leads.view");
  const canCrm = can("crm.view");
  const { data: leadsPending = 0 } = useQuery({
    queryKey: ["leads-pending-count"],
    queryFn: getLeadsPendingCount,
    enabled: canLeads,
    refetchInterval: 60_000,
  });
  const { data: crmPending = 0 } = useQuery({
    queryKey: ["crm-pending"],
    queryFn: getCrmPending,
    enabled: canCrm,
    refetchInterval: 60_000,
  });
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4 md:gap-6 md:px-6">
      <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
        <Truck className="size-5 text-primary" />
        <span className="hidden sm:inline">DriverOps</span>
      </Link>

      <NavLink to="/dashboard" className={navLinkClass}>
        <LayoutDashboard className="size-4" />
        <span className="hidden sm:inline">Dashboard</span>
      </NavLink>

      {can("kanban.view") && (
        <NavLink to="/kanban" className={navLinkClass}>
          <KanbanSquare className="size-4" />
          <span className="hidden sm:inline">Kanban OS</span>
        </NavLink>
      )}

      {canLeads && (
        <NavLink to="/leads" className={navLinkClass}>
          <span className="relative">
            <Inbox className="size-4" />
            {leadsPending > 0 && (
              <span className="absolute -right-2 -top-2 inline-flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground">
                {leadsPending > 99 ? "99+" : leadsPending}
              </span>
            )}
          </span>
          <span className="hidden sm:inline">Pedidos</span>
        </NavLink>
      )}

      {canCrm && (
        <NavLink to="/crm" className={navLinkClass}>
          <span className="relative">
            <Sparkles className="size-4" />
            {crmPending > 0 && (
              <span className="absolute -right-2 -top-2 inline-flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground">
                {crmPending > 99 ? "99+" : crmPending}
              </span>
            )}
          </span>
          <span className="hidden sm:inline">CRM</span>
        </NavLink>
      )}

      <div className="flex-1" />

      {/* Atalho para nova OS -- visível só com permissão de criar OS. */}
      {can("orders.create") && (
        <Button asChild size="sm">
          <Link to="/orders/new">
            <Plus className="size-4" />
            <span className="hidden sm:inline">Nova OS</span>
          </Link>
        </Button>
      )}

      {can("alerts.view") && <NotificationBell />}

      <UserMenu />
    </header>
  );
}
