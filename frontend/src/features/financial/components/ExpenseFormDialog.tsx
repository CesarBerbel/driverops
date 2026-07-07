import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CurrencyInput } from "@/components/shared/CurrencyInput";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { extractErrorMessage } from "@/lib/api-client";
import { formatCurrencyBRL, parseCurrencyBRL } from "@/lib/masks";

import { createExpense, updateExpense } from "../api";
import { EXPENSE_CATEGORY_OPTIONS, PAYMENT_METHOD_OPTIONS } from "../constants";
import type { Expense, ExpenseCategory, PaymentMethod } from "../types";

function todayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function ExpenseFormDialog({
  expense,
  open,
  onOpenChange,
}: {
  expense: Expense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = expense !== null;

  const [description, setDescription] = useState(expense?.description ?? "");
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? "other");
  const [amount, setAmount] = useState(
    expense ? formatCurrencyBRL(Number(expense.amount)) : "",
  );
  const [method, setMethod] = useState<PaymentMethod>(expense?.method ?? "pix");
  const [incurredAt, setIncurredAt] = useState(expense?.incurred_at ?? todayISO());
  const [note, setNote] = useState(expense?.note ?? "");

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        description,
        category,
        amount: String(parseCurrencyBRL(amount) ?? 0),
        method,
        incurred_at: incurredAt,
        note,
      };
      return isEdit ? updateExpense(expense.id, payload) : createExpense(payload);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["expenses"] }),
        queryClient.invalidateQueries({ queryKey: ["financial-dre"] }),
      ]);
      toast.success(isEdit ? "Despesa atualizada." : "Despesa registrada.");
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error(extractErrorMessage(error, "Não foi possível salvar a despesa.")),
  });

  const parsed = parseCurrencyBRL(amount);
  const canSubmit = description.trim().length > 0 && parsed !== null && parsed > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar despesa" : "Nova despesa"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="expense-description">Descrição</Label>
            <Input
              id="expense-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="expense-category">Categoria</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as ExpenseCategory)}
              >
                <SelectTrigger id="expense-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="expense-amount">Valor</Label>
              <CurrencyInput id="expense-amount" value={amount} onChange={setAmount} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="expense-method">Forma de pagamento</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger id="expense-method">
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
              <Label htmlFor="expense-date">Data</Label>
              <Input
                id="expense-date"
                type="date"
                value={incurredAt}
                onChange={(event) => setIncurredAt(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="expense-note">Observação (opcional)</Label>
            <Input
              id="expense-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!canSubmit || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <Loader2 className="animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
