import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Search, Settings2, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { listWorkOrders, type OrderPeriod } from "@/features/orders/api";
import type { OrderStatus } from "@/features/orders/types";
import { getKanbanSettings } from "@/features/settings/api";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { cn } from "@/lib/utils";

import { ServiceOrderKanban } from "../components/ServiceOrderKanban";

const PERIOD_OPTIONS: { value: OrderPeriod; label: string }[] = [
  { value: "all", label: "Todo o período" },
  { value: "today", label: "Hoje" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mês" },
];

export function KanbanPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(() => searchParams.get("q") ?? "");
  const [period, setPeriod] = useState<OrderPeriod>(
    () => (searchParams.get("period") as OrderPeriod) || "all",
  );
  const [overdue, setOverdue] = useState(() => searchParams.get("overdue") === "true");

  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const effectiveSearch = searchInput === "" ? "" : debouncedSearch;

  // Reflect the filters in the URL so a Kanban view can be shared or reloaded
  // without losing state.
  useEffect(() => {
    const params = new URLSearchParams();
    if (effectiveSearch) params.set("q", effectiveSearch);
    if (period !== "all") params.set("period", period);
    if (overdue) params.set("overdue", "true");
    setSearchParams(params, { replace: true });
  }, [effectiveSearch, period, overdue, setSearchParams]);

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["kanban-settings"],
    queryFn: getKanbanSettings,
  });

  const visibleColumns = useMemo<OrderStatus[]>(
    () => (settings?.columns ?? []).filter((c) => c.visible).map((c) => c.status),
    [settings],
  );

  const workQueryKey = [
    "kanban-orders",
    visibleColumns.join(","),
    period,
    overdue,
    effectiveSearch,
  ];

  const {
    data: orders,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: workQueryKey,
    enabled: visibleColumns.length > 0,
    queryFn: () =>
      listWorkOrders({
        statuses: visibleColumns,
        period,
        overdue,
        search: effectiveSearch || undefined,
        active: "active",
      }),
  });

  const hasFilters = Boolean(effectiveSearch) || period !== "all" || overdue;

  function clearFilters() {
    setSearchInput("");
    setPeriod("all");
    setOverdue(false);
  }

  const loading = settingsLoading || (visibleColumns.length > 0 && isLoading);

  return (
    <div className="-m-4 flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden md:-m-6">
      {/* Cabeçalho e filtros fixos no topo do Kanban. */}
      <header className="shrink-0 space-y-3 border-b bg-background px-4 py-3 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Kanban OS</h1>
            <p className="hidden text-sm text-muted-foreground sm:block">
              Acompanhamento operacional das Ordens de Serviço. Arraste os cards entre as
              colunas para mudar o status.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/settings/kanban">
              <Settings2 className="size-4" />
              <span className="hidden sm:inline">Colunas</span>
            </Link>
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por OS, placa, cliente ou telefone..."
              className="pl-9"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
          <Select value={period} onValueChange={(value) => setPeriod(value as OrderPeriod)}>
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
          <Button
            type="button"
            variant={overdue ? "default" : "outline"}
            size="sm"
            onClick={() => setOverdue((value) => !value)}
          >
            <SlidersHorizontal className="size-4" />
            Atrasadas
          </Button>
          {hasFilters && (
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              <X className="size-4" />
              Limpar filtros
            </Button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        {loading ? (
          <div className="flex h-full gap-3 overflow-hidden p-4 md:px-6">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-full w-64 shrink-0" />
            ))}
          </div>
        ) : !settingsLoading && visibleColumns.length === 0 ? (
          <EmptyState
            title="Nenhuma coluna visível"
            description="Todas as colunas estão ocultas. Habilite ao menos uma em Configurações."
            action={
              <Button asChild size="sm" variant="outline">
                <Link to="/settings/kanban">
                  <Settings2 className="size-4" />
                  Configurar colunas
                </Link>
              </Button>
            }
          />
        ) : isError ? (
          <EmptyState
            icon={<AlertCircle className="size-8 text-destructive" />}
            title="Não foi possível carregar as OS"
            description="Ocorreu um erro ao buscar as ordens de serviço."
            action={
              <Button size="sm" variant="outline" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            }
          />
        ) : (orders ?? []).length === 0 && hasFilters ? (
          <EmptyState
            title="Nenhuma OS encontrada"
            description="Nenhuma ordem de serviço corresponde aos filtros aplicados."
            action={
              <Button size="sm" variant="outline" onClick={clearFilters}>
                Limpar filtros
              </Button>
            }
          />
        ) : (
          <ServiceOrderKanban
            orders={orders ?? []}
            columns={visibleColumns}
            queryKey={workQueryKey}
          />
        )}
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn("flex h-full flex-col items-center justify-center gap-3 p-6 text-center")}>
      {icon}
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
