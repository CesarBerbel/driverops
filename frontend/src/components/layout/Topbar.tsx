import { KanbanSquare, LayoutDashboard, Plus, Truck } from "lucide-react";
import { Link, NavLink } from "react-router-dom";

import { Button } from "@/components/ui/button";
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

      <NavLink to="/kanban" className={navLinkClass}>
        <KanbanSquare className="size-4" />
        <span className="hidden sm:inline">Kanban OS</span>
      </NavLink>

      <div className="flex-1" />

      {/* Ação rápida sempre visível para abrir uma nova Ordem de Serviço. */}
      <Button asChild size="sm">
        <Link to="/orders/new">
          <Plus className="size-4" />
          <span className="hidden sm:inline">Nova OS</span>
        </Link>
      </Button>

      <UserMenu />
    </header>
  );
}
