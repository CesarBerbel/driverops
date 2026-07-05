import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ClipboardList,
  Info,
  MessageCircle,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Can } from "@/features/auth/Can";
import { extractErrorMessage } from "@/lib/api-client";
import { formatCurrencyBRL, formatPhone } from "@/lib/masks";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

import { deleteWorkOrder, listWorkOrders, reactivateWorkOrder } from "../api";
import { ORDER_STATUS_OPTIONS, STATUS_FILTER_ALL, STATUS_FILTER_DISABLED } from "../constants";
import { formatOrderNumber } from "../lib/orderMapping";
import type { OrderStatus, WorkOrder } from "../types";

const ORDERS_QUERY_KEY = ["work-orders"];

function formatBrDate(iso: string): string {
  const parts = iso.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : iso;
}

export function OrdersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const effectiveSearch = searchInput === "" ? "" : debouncedSearch;

  // One dropdown mixes the workflow status with the "disabled" (soft-deleted)
  // view -- see constants for the sentinels.
  const [statusFilter, setStatusFilter] = useState<string>(STATUS_FILTER_ALL);
  const [deleteTarget, setDeleteTarget] = useState<WorkOrder | null>(null);

  const isDisabledView = statusFilter === STATUS_FILTER_DISABLED;

  const listParams = {
    search: effectiveSearch || undefined,
    active: isDisabledView ? ("inactive" as const) : ("active" as const),
    status:
      statusFilter === STATUS_FILTER_ALL || statusFilter === STATUS_FILTER_DISABLED
        ? undefined
        : (statusFilter as OrderStatus),
  };

  const {
    data: orders,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [...ORDERS_QUERY_KEY, effectiveSearch, statusFilter],
    queryFn: () => listWorkOrders(listParams),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWorkOrder,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
      toast.success("Ordem de serviço desabilitada.");
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, "Não foi possível desabilitar a OS."));
      setDeleteTarget(null);
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: reactivateWorkOrder,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
      toast.success("Ordem de serviço reativada.");
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, "Não foi possível reativar a OS."));
    },
  });

  const isEmpty = (orders?.length ?? 0) === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ordens de Serviço</h1>
          <p className="text-muted-foreground">
            Crie, acompanhe e finalize os atendimentos da oficina.
          </p>
        </div>
        <Can code="orders.create">
          <Button onClick={() => navigate("/orders/new")}>
            <Plus />
            Nova OS
          </Button>
        </Can>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, placa, cliente..."
            className="pl-9"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>
        {searchInput && (
          <Button variant="ghost" size="sm" onClick={() => setSearchInput("")}>
            <X />
            Limpar pesquisa
          </Button>
        )}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={STATUS_FILTER_ALL}>Todas as ativas</SelectItem>
            {ORDER_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
            <SelectItem value={STATUS_FILTER_DISABLED}>Desabilitadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isDisabledView && (
        <div className="flex items-start gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>Estas ordens estão desabilitadas e não aparecem na listagem padrão.</span>
        </div>
      )}

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
              Não foi possível carregar as ordens de serviço. Tente novamente.
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : isEmpty ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <ClipboardList className="size-8 text-muted-foreground" />
            {effectiveSearch ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma OS encontrada para "{effectiveSearch}".
              </p>
            ) : isDisabledView ? (
              <p className="text-sm text-muted-foreground">Nenhuma OS desabilitada.</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Nenhuma ordem de serviço cadastrada ainda.
                </p>
                <Can code="orders.create">
                  <Button size="sm" onClick={() => navigate("/orders/new")}>
                    <Plus />
                    Nova OS
                  </Button>
                </Can>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Valor final</TableHead>
                <TableHead>Abertura</TableHead>
                <TableHead className="w-0 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders?.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">
                    <button
                      type="button"
                      onClick={() => navigate(`/orders/${order.id}`)}
                      className="text-primary hover:underline focus-visible:underline focus-visible:outline-none"
                    >
                      {formatOrderNumber(order.number)}
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{order.vehicle_plate}</span>
                      {order.vehicle_description && (
                        <span className="text-xs text-muted-foreground">
                          {order.vehicle_description}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{order.customer_name}</span>
                      {order.customer_whatsapp ? (
                        <a
                          href={buildWhatsAppUrl(order.customer_whatsapp)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex w-fit items-center gap-1 text-xs text-success hover:underline"
                        >
                          <MessageCircle className="size-3" />
                          {formatPhone(order.customer_whatsapp)}
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          WhatsApp não informado
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                      {order.status_display}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatCurrencyBRL(Number(order.final_value))}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatBrDate(order.opened_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Editar OS"
                        onClick={() => navigate(`/orders/${order.id}`)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      {isDisabledView ? (
                        <Can code="orders.reactivate">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Reativar OS"
                            disabled={reactivateMutation.isPending}
                            onClick={() => reactivateMutation.mutate(order.id)}
                          >
                            <RotateCcw className="size-4" />
                          </Button>
                        </Can>
                      ) : (
                        <Can code="orders.delete">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Excluir OS"
                            onClick={() => setDeleteTarget(order)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </Can>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desabilitar ordem de serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              A{" "}
              {deleteTarget ? formatOrderNumber(deleteTarget.number) : "OS"} será desabilitada e
              deixará de aparecer na listagem padrão. O registro é preservado e pode ser reativado
              depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
