import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { InlineLoader } from "@/components/loading";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { getUnreadCount, listNotifications, markAllRead, markRead } from "../api";
import { NotificationRow } from "./NotificationRow";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: unread = 0 } = useQuery({
    queryKey: ["notif-unread"],
    queryFn: getUnreadCount,
    refetchInterval: 60_000,
  });

  const {
    data: items,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["notif-recent"],
    queryFn: () => listNotifications({ limit: 8 }),
    enabled: open,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["notif-unread"] });
    queryClient.invalidateQueries({ queryKey: ["notif-recent"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  const readOne = useMutation({ mutationFn: markRead, onSuccess: invalidate });
  const readAll = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => {
      invalidate();
      toast.success("Notificação marcada como lida.");
    },
  });

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative", open && "bg-accent")}
          aria-label={`Notificações${unread > 0 ? ` (${unread} não lidas)` : ""}`}
        >
          <Bell className={cn("size-5", unread > 0 && "text-primary")} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Notificações</span>
            {unread > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {unread} não lidas
              </span>
            )}
          </div>
          {unread > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              disabled={readAll.isPending}
              onClick={() => readAll.mutate()}
            >
              <CheckCheck className="size-3" /> Marcar todas
            </Button>
          )}
        </div>

        <div className="max-h-[24rem] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center p-6">
              <InlineLoader label="Carregando..." />
            </div>
          ) : isError ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Não foi possível carregar as notificações agora. Tente novamente.
            </p>
          ) : !items || items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <Bell className="mx-auto mb-2 size-6 opacity-40" />
              Nenhuma notificação no momento.
            </div>
          ) : (
            items.map((item) => (
              <NotificationRow
                key={item.id}
                item={item}
                compact
                onMarkRead={(id) => readOne.mutate(id)}
                onOpen={() => setOpen(false)}
              />
            ))
          )}
        </div>

        <div className="border-t p-2">
          <Button asChild variant="ghost" className="w-full text-sm" onClick={() => setOpen(false)}>
            <Link to="/notifications">Ver todas</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
