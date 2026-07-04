import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyBRL } from "@/lib/masks";

import { getDashboardStats } from "../api";
import type { DashboardPeriod, DashboardStats } from "../types";

const PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mês" },
  { value: "last30", label: "Últimos 30 dias" },
];

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-primary/40 bg-primary/5" : undefined}>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold tracking-tight text-muted-foreground">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}

export function DashboardAdministrativoView() {
  const [period, setPeriod] = useState<DashboardPeriod>("month");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard-stats", period],
    queryFn: () => getDashboardStats(period),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Visão consolidada dos cadastros, estoque e ordens de serviço.
        </p>
        <Select value={period} onValueChange={(value) => setPeriod(value as DashboardPeriod)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : isError || !data ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertCircle className="size-8 text-destructive" />
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar os indicadores. Tente novamente.
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Indicators data={data} />
      )}
    </div>
  );
}

function Indicators({ data }: { data: DashboardStats }) {
  return (
    <div className="space-y-6">
      <Section title="Ordens de Serviço">
        <StatCard label="OS abertas" value={data.os_open} highlight />
        <StatCard label="OS em andamento" value={data.os_in_progress} highlight />
        <StatCard label="OS finalizadas no período" value={data.os_finished_period} />
        <StatCard
          label="Valor estimado em OS em aberto"
          value={formatCurrencyBRL(Number(data.os_open_value))}
        />
        <StatCard
          label="Valor finalizado no período"
          value={formatCurrencyBRL(Number(data.finished_value_period))}
        />
      </Section>

      <Section title="Cadastros">
        <StatCard label="Clientes" value={data.customers_total} />
        <StatCard label="Veículos" value={data.vehicles_total} />
        <StatCard label="Fornecedores" value={data.suppliers_total} />
        <StatCard label="Serviços" value={data.services_total} />
        <StatCard label="Pacotes de serviços" value={data.packages_total} />
      </Section>

      <Section title="Estoque">
        <StatCard label="Peças cadastradas" value={data.parts_total} />
        <StatCard label="Peças com estoque baixo" value={data.parts_low_stock} />
      </Section>
    </div>
  );
}
