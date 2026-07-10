import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { listStatusHistory } from "../api";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OrderStatusTimeline({ orderId }: { orderId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["work-orders", orderId, "status-history"],
    queryFn: () => listStatusHistory(orderId),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Histórico de status</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : data && data.length > 0 ? (
          <ol className="space-y-4">
            {data.map((entry) => (
              <li key={entry.id} className="flex gap-3">
                <div className="mt-0.5">
                  <Clock className="size-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {entry.from_status_display ? (
                      <>
                        {entry.from_status_display}{" "}
                        <span className="text-muted-foreground">→</span>{" "}
                        {entry.to_status_display}
                      </>
                    ) : (
                      <>OS criada · {entry.to_status_display}</>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(entry.created_at)}
                    {entry.changed_by_name ? ` · ${entry.changed_by_name}` : ""}
                    {entry.source_display && entry.source !== "manual"
                      ? ` · ${entry.source_display}`
                      : ""}
                    {entry.note ? ` · ${entry.note}` : ""}
                  </p>
                  {entry.reason && (
                    <p className="mt-0.5 text-xs italic text-muted-foreground">
                      Motivo: {entry.reason}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhuma mudança de status registrada ainda.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
