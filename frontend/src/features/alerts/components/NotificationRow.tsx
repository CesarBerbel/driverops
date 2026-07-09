import { Check, CheckCheck, ExternalLink, Undo2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

import { PRIORITY_STYLE, fullDate, moduleIcon, relativeTime } from "../constants";
import type { NotificationItem } from "../types";

interface Props {
  item: NotificationItem;
  onMarkRead?: (id: number) => void;
  onMarkUnread?: (id: number) => void;
  onArchive?: (id: number) => void;
  onOpen?: () => void;
  compact?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: number) => void;
}

export function NotificationRow({
  item,
  onMarkRead,
  onMarkUnread,
  onArchive,
  onOpen,
  compact = false,
  selected,
  onToggleSelect,
}: Props) {
  const navigate = useNavigate();
  const Icon = moduleIcon(item.module);
  const prio = PRIORITY_STYLE[item.priority];
  const PrioIcon = prio.icon;
  const unread = item.status === "unread";

  function open() {
    if (unread) onMarkRead?.(item.id);
    onOpen?.();
    if (item.url) navigate(item.url);
  }

  return (
    <div
      className={cn(
        "flex gap-3 border-b p-3 last:border-b-0",
        unread ? "bg-accent/40" : "opacity-80",
      )}
    >
      {onToggleSelect && !compact && (
        <Checkbox
          className="mt-1"
          checked={!!selected}
          onCheckedChange={() => onToggleSelect(item.id)}
          aria-label={`Selecionar ${item.title}`}
        />
      )}

      <span
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
          unread ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={open}
            className="text-left text-sm font-medium hover:underline"
          >
            {item.title}
          </button>
          {unread && (
            <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" aria-label="Não lida" />
          )}
        </div>
        <p className={cn("text-sm text-muted-foreground", compact && "line-clamp-2")}>
          {item.message}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={cn("gap-1", prio.badge)}>
            <PrioIcon className="size-3" />
            {prio.label}
          </Badge>
          <span className="text-xs text-muted-foreground" title={fullDate(item.created_at)}>
            {relativeTime(item.created_at)}
          </span>
          <span className="text-xs text-muted-foreground">· {item.module_display}</span>
        </div>

        <div className="mt-2 flex flex-wrap gap-1">
          {item.url && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={open}>
              <ExternalLink className="size-3" /> {item.action_label || "Abrir"}
            </Button>
          )}
          {unread && onMarkRead && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => onMarkRead(item.id)}
            >
              <Check className="size-3" /> Marcar como lida
            </Button>
          )}
          {!unread && onMarkUnread && !compact && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => onMarkUnread(item.id)}
            >
              <Undo2 className="size-3" /> Marcar como não lida
            </Button>
          )}
          {onArchive && !compact && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => onArchive(item.id)}
            >
              <CheckCheck className="size-3" /> Arquivar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
