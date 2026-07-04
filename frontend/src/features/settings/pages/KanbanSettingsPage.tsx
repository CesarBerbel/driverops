import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowDown, ArrowLeft, Loader2, Lock, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/useAuth";
import { statusLabel } from "@/features/orders/constants";
import { statusPillClass } from "@/features/dashboard/osStatus";
import type { OrderStatus } from "@/features/orders/types";
import { extractErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

import { getKanbanSettings, updateKanbanSettings } from "../api";
import type { KanbanColumnConfig } from "../types";

// Default board configuration -- mirrors backend default_kanban_columns():
// every operational column visible, the two terminal columns hidden.
const DEFAULT_COLUMNS: KanbanColumnConfig[] = [
  { status: "open", visible: true },
  { status: "diagnosing", visible: true },
  { status: "awaiting_approval", visible: true },
  { status: "approved", visible: true },
  { status: "in_progress", visible: true },
  { status: "awaiting_parts", visible: true },
  { status: "testing", visible: true },
  { status: "ready", visible: true },
  { status: "finished", visible: false },
  { status: "canceled", visible: false },
];

export function KanbanSettingsPage() {
  const { user } = useAuth();
  const canEdit = Boolean(user?.is_superuser);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["kanban-settings"],
    queryFn: getKanbanSettings,
  });

  const [columns, setColumns] = useState<KanbanColumnConfig[]>([]);

  useEffect(() => {
    if (data) setColumns(data.columns);
  }, [data]);

  const mutation = useMutation({
    mutationFn: updateKanbanSettings,
    onSuccess: (updated) => {
      setColumns(updated.columns);
      queryClient.setQueryData(["kanban-settings"], updated);
      toast.success("Configurações do Kanban salvas.", { id: "kanban-settings-saved" });
    },
    onError: (error) => {
      toast.error(
        extractErrorMessage(error, "Não foi possível salvar as configurações do Kanban."),
      );
    },
  });

  function toggle(status: OrderStatus) {
    setColumns((prev) =>
      prev.map((c) => (c.status === status ? { ...c, visible: !c.visible } : c)),
    );
  }

  function move(index: number, direction: -1 | 1) {
    setColumns((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const visibleCount = columns.filter((c) => c.visible).length;

  return (
    <div className="space-y-6">
      <Link
        to="/settings"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Configurações
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Kanban OS</h1>
        <p className="text-muted-foreground">
          Escolha quais colunas de status aparecem no Kanban e em que ordem. Isto controla
          apenas a visibilidade — nunca altera o status de nenhuma OS.
        </p>
      </div>

      {!canEdit && (
        <div className="flex items-start gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <span>Apenas superusuários podem alterar as configurações do Kanban.</span>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : isError || !data ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertCircle className="size-8 text-destructive" />
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar as configurações do Kanban. Tente novamente.
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Colunas do Kanban</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {columns.map((column, index) => (
                  <li
                    key={column.status}
                    className="flex items-center gap-3 py-2.5"
                  >
                    <input
                      type="checkbox"
                      id={`col-${column.status}`}
                      checked={column.visible}
                      disabled={!canEdit}
                      onChange={() => toggle(column.status)}
                      className="size-4 accent-primary"
                    />
                    <span className={cn("size-2.5 rounded-full", statusPillClass(column.status))} />
                    <label
                      htmlFor={`col-${column.status}`}
                      className={cn(
                        "flex-1 text-sm font-medium",
                        !column.visible && "text-muted-foreground",
                      )}
                    >
                      {statusLabel(column.status)}
                    </label>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        disabled={!canEdit || index === 0}
                        onClick={() => move(index, -1)}
                        aria-label={`Mover ${statusLabel(column.status)} para cima`}
                      >
                        <ArrowDown className="size-4 rotate-180" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        disabled={!canEdit || index === columns.length - 1}
                        onClick={() => move(index, 1)}
                        aria-label={`Mover ${statusLabel(column.status)} para baixo`}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                {visibleCount} coluna(s) visível(is). As colunas "Finalizada" e "Cancelada"
                vêm desmarcadas por padrão. OS em colunas ocultas continuam no sistema; apenas
                deixam de ser exibidas no Kanban.
              </p>
            </CardContent>
          </Card>

          {canEdit && (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setColumns(DEFAULT_COLUMNS)}
                disabled={mutation.isPending}
              >
                <RotateCcw className="size-4" />
                Restaurar padrão
              </Button>
              <Button
                type="button"
                onClick={() => mutation.mutate({ columns })}
                disabled={mutation.isPending}
              >
                {mutation.isPending && <Loader2 className="animate-spin" />}
                Salvar alterações
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
