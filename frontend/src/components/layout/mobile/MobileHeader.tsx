import { useQuery } from "@tanstack/react-query";
import { Truck } from "lucide-react";
import { Link } from "react-router-dom";

import { NotificationBell } from "@/features/alerts/components/NotificationBell";
import { usePermissionCheck } from "@/features/auth/usePermission";
import { SmartSearchIconTrigger } from "@/features/smart-search/SmartSearchTrigger";
import { getWorkshopProfile } from "@/features/settings/api";

import { MobileUserMenu } from "./MobileUserMenu";

// Header compacto do mobile: logo + nome da oficina à esquerda; sino (se houver
// permissão) e menu do usuário à direita. SEM os menus principais do sistema --
// eles ficam na barra inferior / menu "Mais".
export function MobileHeader() {
  const can = usePermissionCheck();
  // Branding da oficina; degrada com elegância se indisponível.
  const { data: profile } = useQuery({
    queryKey: ["workshop-profile"],
    queryFn: getWorkshopProfile,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const name = profile?.trade_name || profile?.legal_name || "";

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-background px-4 lg:hidden">
      <Link to="/dashboard" className="flex min-w-0 items-center gap-2" aria-label="Início">
        {profile?.logo ? (
          <img
            src={profile.logo}
            alt={name || "Logo da oficina"}
            className="h-8 max-w-[8rem] object-contain"
          />
        ) : (
          <Truck className="size-6 shrink-0 text-primary" />
        )}
        {name && (
          <span className="truncate text-sm font-semibold tracking-tight">{name}</span>
        )}
      </Link>

      <div className="flex items-center gap-1">
        <SmartSearchIconTrigger />
        {can("alerts.view") && <NotificationBell />}
        <MobileUserMenu />
      </div>
    </header>
  );
}
