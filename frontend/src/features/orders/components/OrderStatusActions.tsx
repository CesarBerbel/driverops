import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { extractErrorMessage } from "@/lib/api-client";

import { getOrderTransitions, transitionOrder } from "../api";
import type { OrderStatus, OrderTransition } from "../types";

/**
 * Ações de status da OS dirigidas pelo backend (máquina de estados). Só mostra
 * o que o backend liberou; ações bloqueadas por pré-condição aparecem
 * desabilitadas com o motivo. Transições que exigem justificativa (ou a
 * reabertura) abrem um diálogo antes de executar.
 */
export function OrderStatusActions({ orderId }: { orderId: number }) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<OrderTransition | null>(null);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [reopenTarget, setReopenTarget] = useState<OrderStatus | "">("");

  const { data } = useQuery({
    queryKey: ["order-transitions", orderId],
    queryFn: () => getOrderTransitions(orderId),
  });

  const mutation = useMutation({
    mutationFn: (payload: {
      action: string;
      reason?: string;
      notes?: string;
      target_status?: OrderStatus;
    }) => transitionOrder(orderId, payload),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ["order-transitions", orderId] });
      queryClient.invalidateQueries({ queryKey: ["work-orders", orderId] });
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-status-history", orderId] });
      queryClient.invalidateQueries({ queryKey: ["order-events", orderId] });
      toast.success(`OS agora está "${order.status_display}".`);
      setPending(null);
    },
    onError: (e) => toast.error(extractErrorMessage(e, "Não foi possível mudar o status.")),
  });

  const transitions = data?.transitions ?? [];
  if (transitions.length === 0) return null;

  function run(t: OrderTransition) {
    if (t.reason_required || t.action === "reopen") {
      setReason("");
      setNotes("");
      setReopenTarget(t.reopen_targets?.[0]?.value ?? "");
      setPending(t);
      return;
    }
    mutation.mutate({ action: t.action });
  }

  function confirm() {
    if (!pending) return;
    mutation.mutate({
      action: pending.action,
      reason: reason.trim(),
      notes: notes.trim(),
      target_status:
        pending.action === "reopen" && reopenTarget ? reopenTarget : undefined,
    });
  }

  const reasonNeeded = pending?.reason_required ?? false;
  const reopenNeedsTarget = pending?.action === "reopen";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {transitions.map((t) => (
        <Button
          key={t.action}
          type="button"
          size="sm"
          variant={t.critical ? "outline" : "secondary"}
          disabled={!t.available || mutation.isPending}
          title={t.available ? undefined : t.block_reason}
          className={
            t.action === "cancel" || t.action === "reject"
              ? "text-destructive hover:text-destructive"
              : undefined
          }
          onClick={() => run(t)}
        >
          {t.label}
        </Button>
      ))}
      {transitions.some((t) => !t.available) && (
        <p className="w-full text-xs text-muted-foreground">
          {transitions.find((t) => !t.available)?.block_reason}
        </p>
      )}

      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{pending?.label}</DialogTitle>
            <DialogDescription>
              {reasonNeeded
                ? "Esta ação exige uma justificativa, que fica registrada no histórico da OS."
                : "Confirme a ação. Ela fica registrada no histórico da OS."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {reopenNeedsTarget && (
              <div className="space-y-1">
                <Label>Reabrir para</Label>
                <Select
                  value={reopenTarget}
                  onValueChange={(v) => setReopenTarget(v as OrderStatus)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Status de destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {(pending?.reopen_targets ?? []).map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="transition-reason">
                Justificativa{reasonNeeded ? "" : " (opcional)"}
              </Label>
              <Textarea
                id="transition-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex.: cliente desistiu do serviço."
              />
            </div>
          </div>

          <DialogFooter className="flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancelar
            </Button>
            <Button
              disabled={
                mutation.isPending ||
                (reasonNeeded && !reason.trim()) ||
                (reopenNeedsTarget && !reopenTarget)
              }
              onClick={confirm}
            >
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
