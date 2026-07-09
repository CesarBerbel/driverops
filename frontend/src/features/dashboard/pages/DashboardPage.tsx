import { LoaderPlayground } from "@/components/loading";
import { useAuth } from "@/features/auth/useAuth";

import { DashboardTabs } from "../components/DashboardTabs";

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

      {/* Ferramenta de dev para testar os estados de espera (some no build de produção). */}
      {import.meta.env.DEV && <LoaderPlayground />}

      <DashboardTabs />
    </div>
  );
}
