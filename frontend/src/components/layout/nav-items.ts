import type { LucideIcon } from "lucide-react";
import { LayoutDashboard } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

// Single entry for v1 -- structured as an array so adding future menu items
// (e.g. Veículos, Motoristas, Relatórios) is a one-line change.
export const navItems: NavItem[] = [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }];
