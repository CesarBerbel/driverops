import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Search, Wallet, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CustomerLink } from "@/components/shared/CustomerLink";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ORDER_STATUS_OPTIONS } from "@/features/orders/constants";
import { formatOrderNumber } from "@/features/orders/lib/orderMapping";
import type { OrderStatus, WorkOrder } from "@/features/orders/types";
import { formatCurrencyBRL } from "@/lib/masks";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

import { listReceivables } from "../api";
import { FinancialNav } from "../components/FinancialNav";
import { PAYMENT_STATUS_CLASS, PAYMENT_STATUS_LABEL } from "../constants";
import { RegisterPaymentDialog } from "../components/RegisterPaymentDialog";

const STATUS_ALL = "all";
const RECEIVABLE_STATUS_OPTIONS = ORDER_STATUS_OPTIONS.filter(
  (option) => option.value !== "canceled",
);

export function FinancialPage() {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const effectiveSearch = searchInput === "" ? "" : debouncedSearch;
  const [status, setStatus] = useState<string>(STATUS_ALL);
  const [selected, setSelected] = useState<WorkOrder | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["receivables", effectiveSearch, status],
    queryFn: () =>
      listReceivables({
        search: effectiveSearch || undefined,
        status: status === STATUS_ALL ? undefined : (status as OrderStatus),
      }),
  });

  function openPayment(order: WorkOrder) {
    setSelected(order);
    setDialogOpen(true);
  }

  const rows = data?.results ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
            <p className="text-muted-foreground">
              Contas a receber: OS com saldo em aberto.
            </p>
          </div>
          <FinancialNav />
        </div>
        <Card className="w-full sm:w-auto">
          <CardContent className="flex items-center gap-3 px-4 py-3">
            <Wallet className="size-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Total a receber</p>
              <p className="text-lg font-semibold">
                {formatCurrencyBRL(Number(data?.total_receivable ?? 0))}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, placa ou cliente..."
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
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={STATUS_ALL}>Todos os status</SelectItem>
            {RECEIVABLE_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertCircle className="size-8 text-destructive" />
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar as contas a receber. Tente novamente.
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Wallet className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {effectiveSearch
                ? `Nenhuma conta a receber para "${effectiveSearch}".`
                : "Nenhuma conta a receber. Todas as OS estão quitadas."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead className="text-right">Valor final</TableHead>
                <TableHead className="text-right">Pago</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-0 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">
                    {formatOrderNumber(order.number)}
                  </TableCell>
                  <TableCell>
                    <CustomerLink id={order.customer} name={order.customer_name} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {order.vehicle_plate}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatCurrencyBRL(Number(order.final_value))}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatCurrencyBRL(Number(order.amount_paid))}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrencyBRL(Number(order.balance_due))}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        PAYMENT_STATUS_CLASS[order.payment_status],
                      )}
                    >
                      {PAYMENT_STATUS_LABEL[order.payment_status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => openPayment(order)}>
                      Pagamentos
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <RegisterPaymentDialog
        order={selected}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
