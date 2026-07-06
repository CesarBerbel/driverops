import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Loader2, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissionCheck } from "@/features/auth/usePermission";
import { extractErrorMessage } from "@/lib/api-client";
import { formatQuantityBRL, parseQuantityBRL } from "@/lib/masks";

import { createStockMovement, listStockMovements } from "../api";
import { UNIT_OF_MEASURE_LABELS } from "../constants";
import type { Part, StockMovement, StockMovementKind } from "../types";

interface StockMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  part: Part | null;
}

const KIND_ICON: Record<StockMovementKind, typeof ArrowUpRight> = {
  in: ArrowUpRight,
  out: ArrowDownLeft,
  adjust: SlidersHorizontal,
};

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function StockMovementDialog({ open, onOpenChange, part }: StockMovementDialogProps) {
  const queryClient = useQueryClient();
  const can = usePermissionCheck();
  const canMove = can("parts.stock_move");
  const canAdjust = can("parts.stock_adjust");

  const kindOptions: { value: StockMovementKind; label: string }[] = [
    ...(canMove
      ? ([
          { value: "in", label: "Entrada" },
          { value: "out", label: "Saída" },
        ] as const)
      : []),
    ...(canAdjust ? ([{ value: "adjust", label: "Ajuste (definir saldo)" }] as const) : []),
  ];
  const canWrite = kindOptions.length > 0;

  const [kind, setKind] = useState<StockMovementKind>("in");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  // Ao (re)abrir, começa no primeiro tipo que o usuário pode lançar e limpa o form.
  useEffect(() => {
    if (open) {
      setKind(kindOptions[0]?.value ?? "in");
      setQuantity("");
      setReason("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, part?.id]);

  const movementsQuery = useQuery({
    queryKey: ["parts", part?.id, "movements"],
    queryFn: () => listStockMovements(part!.id),
    enabled: open && part !== null,
  });

  const mutation = useMutation({
    mutationFn: () =>
      createStockMovement(part!.id, { kind, quantity: quantity.replace(",", "."), reason }),
    onSuccess: async (movement) => {
      await queryClient.invalidateQueries({ queryKey: ["parts"] });
      toast.success(
        `Estoque atualizado. Novo saldo: ${formatQuantityBRL(Number(movement.resulting_quantity))}.`,
      );
      setQuantity("");
      setReason("");
    },
    onError: (error) =>
      toast.error(extractErrorMessage(error, "Não foi possível movimentar o estoque.")),
  });

  if (!part) return null;

  const unit = UNIT_OF_MEASURE_LABELS[part.unit_of_measure];
  const parsedQuantity = parseQuantityBRL(quantity);
  const canSubmit =
    parsedQuantity !== null && (kind === "adjust" ? parsedQuantity >= 0 : parsedQuantity > 0);

  function handleSubmit() {
    if (!canSubmit) {
      toast.error("Informe uma quantidade válida.");
      return;
    }
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b p-6">
          <DialogTitle>Movimentar estoque</DialogTitle>
          <DialogDescription>
            {part.name} — saldo atual:{" "}
            <span className="font-medium text-foreground">
              {formatQuantityBRL(Number(part.current_quantity))} {unit}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {canWrite ? (
            <div className="space-y-4 rounded-md border p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="movement-kind">Tipo</Label>
                  <Select
                    value={kind}
                    onValueChange={(value) => setKind(value as StockMovementKind)}
                  >
                    <SelectTrigger id="movement-kind">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {kindOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="movement-quantity">
                    {kind === "adjust" ? "Novo saldo" : "Quantidade"}
                  </Label>
                  <Input
                    id="movement-quantity"
                    inputMode="decimal"
                    placeholder="0"
                    value={quantity}
                    onChange={(event) =>
                      setQuantity(event.target.value.replace(/[^\d,]/g, ""))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="movement-reason">Motivo (opcional)</Label>
                <Input
                  id="movement-reason"
                  placeholder="Compra, devolução, contagem física..."
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSubmit} disabled={!canSubmit || mutation.isPending}>
                  {mutation.isPending && <Loader2 className="animate-spin" />}
                  Lançar movimentação
                </Button>
              </div>
            </div>
          ) : (
            <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              Você pode consultar o histórico, mas não tem permissão para movimentar o estoque.
            </p>
          )}

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Histórico de movimentações</h3>
            {movementsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : movementsQuery.data && movementsQuery.data.length > 0 ? (
              <ul className="divide-y rounded-md border">
                {movementsQuery.data.map((movement: StockMovement) => {
                  const Icon = KIND_ICON[movement.kind];
                  return (
                    <li key={movement.id} className="flex items-start gap-3 p-3 text-sm">
                      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-x-2">
                          <span className="font-medium">
                            {movement.kind_display}
                            {movement.kind !== "adjust" ? " de " : ": "}
                            {formatQuantityBRL(Number(movement.quantity))}
                          </span>
                          <span className="text-muted-foreground">
                            saldo: {formatQuantityBRL(Number(movement.resulting_quantity))}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(movement.created_at)}
                          {movement.created_by_name ? ` · ${movement.created_by_name}` : ""}
                          {movement.order_number ? ` · OS #${movement.order_number}` : ""}
                          {movement.reason ? ` · ${movement.reason}` : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhuma movimentação registrada ainda.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
