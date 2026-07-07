import { Link, useLocation } from "react-router-dom";

import { usePermissionCheck } from "@/features/auth/usePermission";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/financial", label: "Contas a receber", permission: "financial.view" },
  { to: "/financial/reports", label: "Relatórios", permission: "financial.reports" },
];

export function FinancialNav() {
  const { pathname } = useLocation();
  const can = usePermissionCheck();
  const tabs = TABS.filter((tab) => can(tab.permission));

  return (
    <div className="inline-flex rounded-md border bg-muted/40 p-1">
      {tabs.map((tab) => {
        const isActive = pathname === tab.to;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={cn(
              "rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
