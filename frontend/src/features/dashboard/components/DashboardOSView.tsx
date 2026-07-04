import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { ORDER_STATUS_OPTIONS } from "@/features/orders/constants";
import { OPEN_STATUSES, IN_PROGRESS_STATUSES } from "@/features/orders/constants";
import type { OrderStatus, WorkOrder } from "@/features/orders/types";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

import { statusColumn } from "../osStatus";
import { OSQuickViewModal } from "./OSQuickViewModal";
import { OSVehicleCard } from "./OSVehicleCard";

const PERIOD_OPTIONS: { value: OrderPeriod; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "today", label: "Hoje" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mês" },
];

const OPERATIONAL_STATUS_OPTIONS = ORDER_STATUS_OPTIONS.filter(
  (option) =>
    OPEN_STATUSES.includes(option.value) || IN_PROGRESS_STATUSES.includes(option.value),
);

const STATUS_ALL = "all";

function Column({
  title,
  orders,
  emptyLabel,
  onSelect,
}: {
  title: string;
  orders: WorkOrder[];
  emptyLabel: string;
  onSelect: (order: WorkOrder) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {orders.length}
        </span>
      </div>
      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {orders.map((order) => (
            <OSVehicleCard key={order.id} order={order} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

export function DashboardOSView() {
  const [period, setPeriod] = useState<OrderPeriod>("all");
  const [status, setStatus] = useState<string>(STATUS_ALL);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const effectiveSearch = searchInput === "" ? "" : debouncedSearch;
  const [selected, setSelected] = useState<WorkOrder | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const {
    data: orders,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["work-orders", "board", period, status, effectiveSearch],
    queryFn: () =>
      listWorkOrders({
        board: "operational",
        period,
        status: status === STATUS_ALL ? undefined : (status as OrderStatus),
        search: effectiveSearch || undefined,
      }),
  });

  const { open, inProgress } = useMemo(() => {
    const grouped = { open: [] as WorkOrder[], inProgress: [] as WorkOrder[] };
    for (const order of orders ?? []) {
      const column = statusColumn(order.status);
      if (column === "open") grouped.open.push(order);
      else if (column === "in_progress") grouped.inProgress.push(order);
    }
    return grouped;
  }, [orders]);

  function openModal(order: WorkOrder) {
    setSelected(order);
    setModalOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por placa ou cliente..."
            className="pl-9"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>
        {searchInput && (
          <Button variant="ghost" size="sm" onClick={() => setSearchInput("")}>
            <X />
            Limpar
          </Button>
        )}
        <Select value={period} onValueChange={(value) => setPeriod(value as OrderPeriod)}>
          <SelectTrigger className="w-40">
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
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={STATUS_ALL}>Todos os status</SelectItem>
            {OPERATIONAL_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          {[0, 1].map((col) => (
            <div key={col} className="space-y-3">
              <Skeleton className="h-5 w-24" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-52 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertCircle className="size-8 text-destructive" />
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar as ordens de serviço. Tente novamente.
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Column
            title="Abertas"
            orders={open}
            emptyLabel="Nenhuma OS aberta no momento."
            onSelect={openModal}
          />
          <Column
            title="Em andamento"
            orders={inProgress}
            emptyLabel="Nenhuma OS em andamento no momento."
            onSelect={openModal}
          />
        </div>
      )}

      <OSQuickViewModal order={selected} open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
}
