import { NavLink } from "react-router-dom";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { usePermissionCheck } from "@/features/auth/usePermission";
import { cn } from "@/lib/utils";

import { visibleMoreGroups } from "./moreMenuItems";

interface MobileMoreMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Painel deslizante (bottom sheet) com todos os módulos permitidos, agrupados.
// Respeita permissões e não inclui "Orçamentos" (é parte da OS).
export function MobileMoreMenu({ open, onOpenChange }: MobileMoreMenuProps) {
  const can = usePermissionCheck();
  const groups = visibleMoreGroups(can);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85svh] overflow-y-auto rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader>
          <SheetTitle>Mais</SheetTitle>
        </SheetHeader>
        <nav className="space-y-5 px-4 pb-4" aria-label="Mais módulos">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.title}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => onOpenChange(false)}
                      className={({ isActive }) =>
                        cn(
                          "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center text-xs font-medium transition-colors",
                          isActive
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "bg-card text-foreground hover:bg-accent",
                        )
                      }
                    >
                      <Icon className="size-5" />
                      <span className="leading-tight">{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
