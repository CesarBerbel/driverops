import { Link, useLocation } from "react-router-dom";

import { cn } from "@/lib/utils";

const TABS = [
  { to: "/services", label: "Serviços" },
  { to: "/services/packages", label: "Pacotes de Serviços" },
];

export function ServicesNav() {
  const { pathname } = useLocation();

  return (
    <div className="inline-flex rounded-md border bg-muted/40 p-1">
      {TABS.map((tab) => {
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
