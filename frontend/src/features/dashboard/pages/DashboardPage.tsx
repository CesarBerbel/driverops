import { useAuth } from "@/features/auth/useAuth";

import { DashboardTabs } from "../components/DashboardTabs";
import { OrdersHeroCard } from "../components/OrdersHeroCard";

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Bem-vindo, {user?.full_name || user?.email}
        </h1>
        <p className="text-muted-foreground">Este é o painel inicial do DriverOps.</p>
      </div>

      {/* Acesso às Ordens de Serviço em destaque, acima das abas. */}
      <OrdersHeroCard />

      <DashboardTabs />
    </div>
  );
}
