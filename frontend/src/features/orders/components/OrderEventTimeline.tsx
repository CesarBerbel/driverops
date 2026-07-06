import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  FilePlus2,
  ImageOff,
  ImagePlus,
  Send,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { listOrderEvents } from "../api";
import type { OrderEventType } from "../types";

const EVENT_ICON: Record<OrderEventType, typeof Clock> = {
  created: FilePlus2,
  status_changed: SlidersHorizontal,
  attachment_added: ImagePlus,
  attachment_removed: ImageOff,
  quote_created: FilePlus2,
  quote_sent: Send,
  quote_approved: CheckCircle2,
  quote_partially_approved: CheckCircle2,
  quote_rejected: XCircle,
};

const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Todos os eventos" },
  { value: "status_changed", label: "Mudanças de status" },
  { value: "attachment_added", label: "Fotos adicionadas" },
  { value: "attachment_removed", label: "Fotos removidas" },
  { value: "quote_created", label: "Orçamento criado" },
  { value: "quote_sent", label: "Orçamento enviado" },
  { value: "quote_approved", label: "Orçamento aprovado" },
  { value: "quote_partially_approved", label: "Aprovação parcial" },
  { value: "quote_rejected", label: "Orçamento recusado" },
];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OrderEventTimeline({ orderId }: { orderId: number }) {
  const [filter, setFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["work-orders", orderId, "events", filter],
    queryFn: () =>
      listOrderEvents(orderId, filter === "all" ? undefined : (filter as OrderEventType)),
  });

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <CardTitle className="text-base">Histórico da OS</CardTitle>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : data && data.length > 0 ? (
          <ol className="space-y-4">
            {data.map((event) => {
              const Icon = EVENT_ICON[event.event_type] ?? Clock;
              return (
                <li key={event.id} className="flex gap-3">
                  <div className="mt-0.5">
                    <Icon className="size-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {event.event_type_display}
                      {event.description ? (
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          · {event.description}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(event.created_at)}
                      {event.actor_name ? ` · ${event.actor_name}` : ""}
                      {event.channel ? ` · ${event.channel}` : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">
            {filter === "all"
              ? "Nenhum evento registrado ainda."
              : "Nenhum evento deste tipo."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
