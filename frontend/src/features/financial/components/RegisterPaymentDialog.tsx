import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CurrencyInput } from "@/components/shared/CurrencyInput";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Can } from "@/features/auth/Can";
import { formatOrderNumber } from "@/features/orders/lib/orderMapping";
import type { PaymentStatus, WorkOrder } from "@/features/orders/types";
import { extractErrorMessage } from "@/lib/api-client";
import { formatCurrencyBRL, parseCurrencyBRL } from "@/lib/masks";

import { createPayment, deletePayment, listPayments } from "../api";
import { PAYMENT_METHOD_OPTIONS, PAYMENT_STATUS_CLASS, PAYMENT_STATUS_LABEL } from "../constants";
import type { PaymentMethod } from "../types";
import { cn } from "@/lib/utils";

function todayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function formatBrDate(iso: string): string {
  const parts = iso.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : iso;
}

export function RegisterPaymentDialog({
  order,
  open,
  onOpenChange,
}: {
  order: WorkOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const orderId = order?.id ?? 0;

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [paidAt, setPaidAt] = useState(todayISO());
  const [note, setNote] = useState("");

  const { data: payments } = useQuery({
    queryKey: ["payments", orderId],
    queryFn: () => listPayments(orderId),
    enabled: open && orderId > 0,
  });

  function invalidate() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ["payments", orderId] }),
      queryClient.invalidateQueries({ queryKey: ["receivables"] }),
      queryClient.invalidateQueries({ queryKey: ["work-orders"] }),
    ]);
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createPayment({
        order: orderId,
        amount: String(parseCurrencyBRL(amount) ?? 0),
        method,
        paid_at: paidAt,
        note,
      }),
    onSuccess: async () => {
      await invalidate();
      setAmount("");
      setNote("");
      toast.success("Pagamento registrado.");
    },
    onError: (error) =>
      toast.error(extractErrorMessage(error, "Não foi possível registrar o pagamento.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deletePayment(id),
    onSuccess: async () => {
      await invalidate();
      toast.success("Pagamento estornado.");
    },
    onError: (error) =>
      toast.error(extractErrorMessage(error, "Não foi possível estornar o pagamento.")),
  });

  if (!order) return null;

  const finalValue = Number(order.final_value);
  const paid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = Math.max(0, finalValue - paid);
  const status: PaymentStatus = paid <= 0 ? "open" : paid < finalValue ? "partial" : "paid";

  const parsedAmount = parseCurrencyBRL(amount);
  const canSubmit = parsedAmount !== null && parsedAmount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b p-5">
          <DialogTitle className="flex items-center gap-2">
            {formatOrderNumber(order.number)}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                PAYMENT_STATUS_CLASS[status],
              )}
            >
              {PAYMENT_STATUS_LABEL[status]}
            </span>
          </DialogTitle>
          <DialogDescription>
            {order.customer_name} · {order.vehicle_plate}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className="grid grid-cols-3 gap-3 rounded-md border bg-muted/30 p-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Valor final</p>
              <p className="font-medium">{formatCurrencyBRL(finalValue)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pago</p>
              <p className="font-medium">{formatCurrencyBRL(paid)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo devedor</p>
              <p className="font-semibold">{formatCurrencyBRL(balance)}</p>
            </div>
          </div>

          <Can code="financial.register_payment">
            <div className="space-y-3 rounded-md border p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="payment-amount">Valor</Label>
                  <CurrencyInput id="payment-amount" value={amount} onChange={setAmount} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="payment-method">Forma de pagamento</Label>
                  <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                    <SelectTrigger id="payment-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHOD_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="payment-date">Data</Label>
                  <Input
                    id="payment-date"
                    type="date"
                    value={paidAt}
                    onChange={(event) => setPaidAt(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="payment-note">Observação (opcional)</Label>
                  <Input
                    id="payment-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  disabled={!canSubmit || createMutation.isPending}
                  onClick={() => createMutation.mutate()}
                >
                  {createMutation.isPending && <Loader2 className="animate-spin" />}
                  Registrar pagamento
                </Button>
              </div>
            </div>
          </Can>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Pagamentos</h3>
            {payments && payments.length > 0 ? (
              <ul className="divide-y rounded-md border">
                {payments.map((payment) => (
                  <li key={payment.id} className="flex items-center gap-3 p-3 text-sm">
                    <div className="flex-1">
                      <p className="font-medium">
                        {formatCurrencyBRL(Number(payment.amount))} · {payment.method_display}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatBrDate(payment.paid_at)}
                        {payment.created_by_name ? ` · ${payment.created_by_name}` : ""}
                        {payment.note ? ` · ${payment.note}` : ""}
                      </p>
                    </div>
                    <Can code="financial.register_payment">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Estornar pagamento"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(payment.id)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </Can>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum pagamento registrado nesta OS.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
