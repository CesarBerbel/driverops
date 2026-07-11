import { CalendarClock, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrencyBRL } from "@/lib/masks";

import type { Expense } from "../types";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const parts = iso.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : iso;
}

// Card mobile da despesa: espelha as colunas da tabela do financeiro
// (descrição, valor, data, categoria, forma) num formato empilhado para o
// celular. As ações de editar/excluir só aparecem quando a página passa os
// handlers -- a página os fornece conforme a permissão do usuário (mesma
// regra do `Can` que guarda as ações na tabela).
export function ExpenseMobileCard({
  expense,
  onEdit,
  onDelete,
  deleting,
}: {
  expense: Expense;
  onEdit?: (expense: Expense) => void;
  onDelete?: (expense: Expense) => void;
  deleting?: boolean;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold leading-snug">{expense.description}</p>
          <span className="shrink-0 text-sm font-semibold">
            {formatCurrencyBRL(Number(expense.amount))}
          </span>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="size-3" />
            {fmtDate(expense.incurred_at)}
          </span>
          {expense.category_display && <span>{expense.category_display}</span>}
          {expense.method_display && <span>{expense.method_display}</span>}
        </div>

        {(onEdit || onDelete) && (
          <div className="flex items-center gap-1.5 pt-1">
            {onEdit && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                title="Editar despesa"
                aria-label="Editar despesa"
                onClick={() => onEdit(expense)}
              >
                <Pencil className="size-4" />
                Editar
              </Button>
            )}
            {onDelete && (
              <Button
                size="sm"
                variant="outline"
                title="Excluir despesa"
                aria-label="Excluir despesa"
                disabled={deleting}
                onClick={() => onDelete(expense)}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
