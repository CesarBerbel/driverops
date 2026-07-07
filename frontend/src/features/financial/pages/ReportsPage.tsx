import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyBRL } from "@/lib/masks";

import { getDre, getFinancialReport, type ReportPeriod } from "../api";
import { FinancialNav } from "../components/FinancialNav";
import { cn } from "@/lib/utils";

const PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mês" },
  { value: "last30", label: "Últimos 30 dias" },
  { value: "all", label: "Tudo" },
];

function formatBrDate(iso: string): string {
  const parts = iso.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : iso;
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

export function ReportsPage() {
  const [period, setPeriod] = useState<ReportPeriod>("month");

  const { data, isLoading } = useQuery({
    queryKey: ["financial-report", period],
    queryFn: () => getFinancialReport(period),
  });
  const { data: dre } = useQuery({
    queryKey: ["financial-dre", period],
    queryFn: () => getDre(period),
  });

  const byDay = data?.by_day ?? [];
  const byMethod = data?.by_method ?? [];
  const byCategory = dre?.expenses_by_category ?? [];
  const maxDay = Math.max(0, ...byDay.map((d) => Number(d.total)));
  const maxMethod = Math.max(0, ...byMethod.map((m) => Number(m.total)));
  const maxCategory = Math.max(0, ...byCategory.map((c) => Number(c.total)));
  const result = Number(dre?.result ?? 0);
  const hasData =
    Number(data?.total_received ?? 0) > 0 || Number(dre?.total_expenses ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
          <p className="text-muted-foreground">
            Relatórios de recebimentos por período.
          </p>
        </div>
        <FinancialNav />
      </div>

      <div className="flex items-center gap-3">
        <Select value={period} onValueChange={(value) => setPeriod(value as ReportPeriod)}>
          <SelectTrigger className="w-48">
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <>
          {/* DRE / resultado do período: receitas − despesas. */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Receitas"
              value={formatCurrencyBRL(Number(dre?.total_revenue ?? 0))}
            />
            <StatTile
              label="Despesas"
              value={formatCurrencyBRL(Number(dre?.total_expenses ?? 0))}
            />
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Resultado</p>
                <p
                  className={cn(
                    "text-2xl font-semibold tracking-tight",
                    result >= 0 ? "text-success" : "text-destructive",
                  )}
                >
                  {formatCurrencyBRL(result)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {result >= 0 ? "lucro no período" : "prejuízo no período"}
                </p>
              </CardContent>
            </Card>
            <StatTile
              label="Ticket médio"
              value={formatCurrencyBRL(Number(data?.average_ticket ?? 0))}
            />
          </div>

          {!hasData ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Nenhum lançamento no período.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
              {/* Recebimentos por dia -- série única (valor recebido), hue único. */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recebimentos por dia</CardTitle>
                </CardHeader>
                <CardContent>
                  <figure aria-label="Recebimentos por dia no período">
                    <div className="flex h-40 items-end gap-1">
                      {byDay.map((day) => {
                        const height = maxDay > 0 ? (Number(day.total) / maxDay) * 100 : 0;
                        return (
                          <div
                            key={day.date}
                            className="flex h-full flex-1 flex-col justify-end"
                            title={`${formatBrDate(day.date)}: ${formatCurrencyBRL(Number(day.total))}`}
                          >
                            <div
                              className="w-full rounded-t bg-primary"
                              style={{ height: `${height}%` }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    {byDay.length > 0 && (
                      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                        <span>{formatBrDate(byDay[0].date)}</span>
                        <span>{formatBrDate(byDay[byDay.length - 1].date)}</span>
                      </div>
                    )}
                  </figure>
                </CardContent>
              </Card>

              {/* Por forma de pagamento -- barras horizontais, hue único + rótulos. */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Por forma de pagamento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {byMethod.map((method) => {
                    const width =
                      maxMethod > 0 ? (Number(method.total) / maxMethod) * 100 : 0;
                    return (
                      <div key={method.method} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>
                            {method.method_display}{" "}
                            <span className="text-muted-foreground">· {method.count}</span>
                          </span>
                          <span className="font-medium">
                            {formatCurrencyBRL(Number(method.total))}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Despesas por categoria -- barras hue único + rótulos. */}
              {byCategory.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Despesas por categoria</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {byCategory.map((cat) => {
                      const width =
                        maxCategory > 0 ? (Number(cat.total) / maxCategory) * 100 : 0;
                      return (
                        <div key={cat.category} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>
                              {cat.category_display}{" "}
                              <span className="text-muted-foreground">· {cat.count}</span>
                            </span>
                            <span className="font-medium">
                              {formatCurrencyBRL(Number(cat.total))}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full bg-destructive"
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
