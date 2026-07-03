import { LayoutDashboard, Truck } from "lucide-react";
import { Link, NavLink } from "react-router-dom";

import { cn } from "@/lib/utils";

import { UserMenu } from "./UserMenu";

export function Topbar() {
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-6 border-b bg-background px-4 md:px-6">
      <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
        <Truck className="size-5 text-primary" />
        <span className="hidden sm:inline">DriverOps</span>
      </Link>

      <NavLink
        to="/dashboard"
        className={({ isActive }) =>
          cn(
            "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            isActive
              ? "bg-secondary text-secondary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )
        }
      >
        <LayoutDashboard className="size-4" />
        Dashboard
      </NavLink>

      <div className="flex-1" />

      <UserMenu />
    </header>
  );
}
