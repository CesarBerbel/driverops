import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ListTodo, Lock, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { PageLoader } from "@/components/loading";
import { CustomerLink } from "@/components/shared/CustomerLink";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermissionCheck } from "@/features/auth/usePermission";
import { formatBrDate } from "@/features/dashboard/osStatus";
import { extractErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

import { deleteTask, listTasks, updateTask } from "../api";
import { PRIORITY, PRIORITY_OPTIONS, TASK_STATUS, TASK_STATUS_FILTERS } from "../constants";
import { CrmTabs } from "../CrmTabs";
import { TaskFormDialog } from "../TaskFormDialog";
import type { CrmTask } from "../types";

const ALL = "all";

function isOverdue(task: CrmTask): boolean {
  if (!task.due_date || task.status !== "open") return false;
  return task.due_date < new Date().toISOString().slice(0, 10);
}

export function CrmTasksPage() {
  const can = usePermissionCheck();
  const queryClient = useQueryClient();
  const canManage = can("crm.assign_task");

  const [status, setStatus] = useState("open");
  const [priority, setPriority] = useState(ALL);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CrmTask | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CrmTask | null>(null);

  const filters = {
    open: status === "open" ? "1" : undefined,
    status: status && status !== "open" ? status : undefined,
    priority: priority === ALL ? undefined : priority,
    q: search || undefined,
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["crm-tasks", filters],
    queryFn: () => listTasks(filters),
    enabled: can("crm.view"),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["crm-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["crm-tasks-pending"] });
  }

  const statusMut = useMutation({
    mutationFn: ({ id, next }: { id: number; next: CrmTask["status"] }) =>
      updateTask(id, { status: next }),
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(extractErrorMessage(e, "Não foi possível atualizar a tarefa.")),
  });

  const removeMut = useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      toast.success("Tarefa excluída.");
    },
    onError: (e) => toast.error(extractErrorMessage(e, "Não foi possível excluir a tarefa.")),
  });

  if (!can("crm.view")) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
        <Lock className="size-7 opacity-60" />
        <p className="text-sm">Você não tem permissão para ver o CRM inteligente.</p>
      </div>
    );
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(task: CrmTask) {
    setEditing(task);
    setFormOpen(true);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <ListTodo className="size-5 text-primary" /> CRM Inteligente — Tarefas
          </h1>
          <p className="text-sm text-muted-foreground">
            Pendências de relacionamento a executar, com responsável e prazo.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" /> Nova tarefa
          </Button>
        )}
      </div>

      <CrmTabs />

      <div className="space-y-2">
        <div className="flex flex-wrap gap-1">
          {TASK_STATUS_FILTERS.map((t) => (
            <Button
              key={t.value || "todas"}
              size="sm"
              variant={status === t.value ? "default" : "outline"}
              onClick={() => setStatus(t.value)}
            >
              {t.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as prioridades</SelectItem>
              {PRIORITY_OPTIONS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="w-56"
            placeholder="Buscar por título ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <PageLoader label="Carregando tarefas..." />
      ) : isError ? (
        <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
          Não foi possível carregar as tarefas. Tente novamente.
          <div className="mt-3">
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        </div>
      ) : !data || data.length === 0 ? (
        <div className="rounded-md border p-10 text-center text-sm text-muted-foreground">
          <ListTodo className="mx-auto mb-3 size-8 opacity-40" />
          <p className="font-medium text-foreground">Nenhuma tarefa por aqui.</p>
          <p>
            Crie tarefas a partir das{" "}
            <Link className="text-primary hover:underline" to="/crm">
              Próximas Ações
            </Link>{" "}
            ou pelo botão "Nova tarefa".
          </p>
        </div>
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarefa</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Vínculo</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-0 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="max-w-xs">
                    <p className="font-medium">{task.title}</p>
                    {task.assigned_to_name && (
                      <p className="text-xs text-muted-foreground">
                        Responsável: {task.assigned_to_name}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <CustomerLink id={task.customer} name={task.customer_name} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <div className="flex flex-col gap-0.5">
                      {task.work_order_number != null && (
                        <Link className="text-primary hover:underline" to={`/orders/${task.work_order}`}>
                          OS #{task.work_order_number}
                        </Link>
                      )}
                      {task.vehicle_plate && <span>{task.vehicle_plate}</span>}
                      {task.work_order_number == null && !task.vehicle_plate && "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={PRIORITY[task.priority].badge}>
                      {task.priority_display}
                    </Badge>
                  </TableCell>
                  <TableCell className={cn("text-sm", isOverdue(task) && "font-medium text-destructive")}>
                    {formatBrDate(task.due_date)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={TASK_STATUS[task.status].badge}>
                      {task.status_display}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {canManage && (
                      <div className="flex justify-end gap-0.5">
                        {task.status === "open" ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Concluir"
                              aria-label="Concluir"
                              disabled={statusMut.isPending}
                              onClick={() => statusMut.mutate({ id: task.id, next: "done" })}
                            >
                              <Check className="text-emerald-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Cancelar"
                              aria-label="Cancelar"
                              disabled={statusMut.isPending}
                              onClick={() => statusMut.mutate({ id: task.id, next: "canceled" })}
                            >
                              <X />
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Reabrir"
                            aria-label="Reabrir"
                            disabled={statusMut.isPending}
                            onClick={() => statusMut.mutate({ id: task.id, next: "open" })}
                          >
                            <RotateCcw />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Editar"
                          aria-label="Editar"
                          onClick={() => openEdit(task)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          title="Excluir"
                          aria-label="Excluir"
                          onClick={() => setDeleteTarget(task)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editing}
        onSaved={invalidate}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              A tarefa <strong>{deleteTarget?.title}</strong> será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && removeMut.mutate(deleteTarget.id)}
              disabled={removeMut.isPending}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
