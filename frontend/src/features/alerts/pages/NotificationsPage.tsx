import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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
import { cn } from "@/lib/utils";

import {
  archiveNotification,
  listNotifications,
  markAllRead,
  markRead,
  markReadBulk,
  markUnread,
} from "../api";
import { NotificationRow } from "../components/NotificationRow";
import { MODULE_OPTIONS, PRIORITY_OPTIONS, groupByDate } from "../constants";
import type { NotificationFilters } from "../types";

const STATUS_TABS = [
  { value: "", label: "Todas" },
  { value: "unread", label: "Não lidas" },
  { value: "read", label: "Lidas" },
  { value: "archived", label: "Arquivadas" },
];

const ALL = "all";

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [module, setModule] = useState(ALL);
  const [priority, setPriority] = useState(ALL);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const filters: NotificationFilters = {
    status: status || "all",
    module: module === ALL ? undefined : module,
    priority: priority === ALL ? undefined : priority,
    q: search || undefined,
  };

  const { data: items, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["notifications", filters],
    queryFn: () => listNotifications(filters),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["notif-unread"] });
    queryClient.invalidateQueries({ queryKey: ["notif-recent"] });
  }

  const readOne = useMutation({ mutationFn: markRead, onSuccess: invalidate });
  const unreadOne = useMutation({ mutationFn: markUnread, onSuccess: invalidate });
  const archiveOne = useMutation({ mutationFn: archiveNotification, onSuccess: invalidate });
  const readAll = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => {
      invalidate();
      toast.success("Notificação marcada como lida.");
    },
  });
  const readSelected = useMutation({
    mutationFn: (ids: number[]) => markReadBulk(ids),
    onSuccess: () => {
      invalidate();
      setSelected(new Set());
      toast.success("Notificação marcada como lida.");
    },
  });

  const unreadTotal = useMemo(
    () => (items ?? []).filter((n) => n.status === "unread").length,
    [items],
  );
  const groups = useMemo(() => groupByDate(items ?? []), [items]);

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Central de Notificações</h1>
          <p className="text-sm text-muted-foreground">
            {unreadTotal > 0
              ? `${unreadTotal} não lida(s) nesta visão.`
              : "Nenhuma não lida nesta visão."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("size-4", isFetching && "animate-spin")} /> Atualizar
          </Button>
          <Button size="sm" onClick={() => readAll.mutate()} disabled={readAll.isPending}>
            <CheckCheck className="size-4" /> Marcar todas como lidas
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1">
          {STATUS_TABS.map((tab) => (
            <Button
              key={tab.value}
              size="sm"
              variant={status === tab.value ? "default" : "outline"}
              onClick={() => setStatus(tab.value)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={module} onValueChange={setModule}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Módulo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os módulos</SelectItem>
              {MODULE_OPTIONS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
            placeholder="Buscar por texto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-md border bg-accent/40 px-3 py-2 text-sm">
          <span>{selected.size} selecionada(s)</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7"
            onClick={() => readSelected.mutate([...selected])}
          >
            <CheckCheck className="size-3" /> Marcar como lida
          </Button>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setSelected(new Set())}>
            Limpar
          </Button>
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : isError ? (
        <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
          Não foi possível carregar as notificações agora. Tente novamente.
          <div className="mt-3">
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        </div>
      ) : !items || items.length === 0 ? (
        <div className="rounded-md border p-10 text-center text-sm text-muted-foreground">
          <Bell className="mx-auto mb-3 size-8 opacity-40" />
          <p className="font-medium text-foreground">Nenhuma notificação no momento.</p>
          <p>
            Quando houver pedidos, prazos ou pendências importantes, eles aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="mb-1 px-1 text-xs font-medium uppercase text-muted-foreground">
                {group.label}
              </p>
              <div className="overflow-hidden rounded-md border">
                {group.items.map((item) => (
                  <NotificationRow
                    key={item.id}
                    item={item}
                    selected={selected.has(item.id)}
                    onToggleSelect={toggleSelect}
                    onMarkRead={(id) => readOne.mutate(id)}
                    onMarkUnread={(id) => unreadOne.mutate(id)}
                    onArchive={(id) => archiveOne.mutate(id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
