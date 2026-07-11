import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { AlertCircle, Pencil, Plus, Search, Trash2, TrendingDown, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Can } from "@/features/auth/Can";
import { useHasPermission } from "@/features/auth/usePermission";
import { Pagination } from "@/components/shared/Pagination";
import { ResponsiveDataView } from "@/components/shared/ResponsiveDataView";
import { extractErrorMessage } from "@/lib/api-client";
import { formatCurrencyBRL } from "@/lib/masks";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

import { deleteExpense, listExpenses, listExpensesPage, type ReportPeriod } from "../api";
import { EXPENSE_CATEGORY_OPTIONS } from "../constants";
import { ExpenseFormDialog } from "../components/ExpenseFormDialog";
import { ExpenseMobileCard } from "../components/ExpenseMobileCard";
import { FinancialNav } from "../components/FinancialNav";
import type { Expense } from "../types";

const PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mês" },
  { value: "last30", label: "Últimos 30 dias" },
  { value: "all", label: "Tudo" },
];

const CATEGORY_ALL = "all";

function formatBrDate(iso: string): string {
  const parts = iso.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : iso;
}

export function ExpensesPage() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<ReportPeriod>("month");
  const [category, setCategory] = useState<string>(CATEGORY_ALL);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const effectiveSearch = searchInput === "" ? "" : debouncedSearch;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [page, setPage] = useState(1);
  // Voltar para a 1ª página sempre que o filtro/busca muda (senão você poderia
  // ficar numa página que não existe mais no resultado filtrado).
  useEffect(() => {
    setPage(1);
  }, [period, category, effectiveSearch]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["expenses", page, period, category, effectiveSearch],
    queryFn: () =>
      listExpensesPage(page, {
        period,
        category: category === CATEGORY_ALL ? undefined : category,
        search: effectiveSearch || undefined,
      }),
    // Mantém a página anterior visível enquanto a próxima carrega (sem "piscar").
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteExpense(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["expenses"] }),
        queryClient.invalidateQueries({ queryKey: ["financial-dre"] }),
      ]);
      toast.success("Despesa excluída.");
    },
    onError: (error) =>
      toast.error(extractErrorMessage(error, "Não foi possível excluir a despesa.")),
  });

  const expenses = data?.results ?? [];
  const isEmpty = (data?.count ?? 0) === 0;
  // Mesma regra do <Can> que guarda as ações na tabela: só passamos handlers
  // ao card mobile quando o usuário pode gerenciar despesas.
  const canManage = useHasPermission("financial.register_expense");

  // O card "Total no período" precisa somar o CONJUNTO FILTRADO inteiro, não só a
  // página atual -- por isso uma query separada, não paginada (o backend limita
  // em 200, mesmo teto de antes de a tabela paginar). Sem ?page, listExpenses
  // devolve o array cortado no teto.
  const { data: allForTotal } = useQuery({
    queryKey: ["expenses-total", period, category, effectiveSearch],
    queryFn: () =>
      listExpenses({
        period,
        category: category === CATEGORY_ALL ? undefined : category,
        search: effectiveSearch || undefined,
      }),
    placeholderData: keepPreviousData,
  });
  const total = (allForTotal ?? []).reduce((sum, e) => sum + Number(e.amount), 0);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(expense: Expense) {
    setEditing(expense);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
            <p className="text-muted-foreground">Despesas da oficina (saídas de caixa).</p>
          </div>
          <FinancialNav />
        </div>
        <div className="flex items-center gap-3">
          <Card>
            <CardContent className="flex items-center gap-3 px-4 py-3">
              <TrendingDown className="size-5 text-destructive" />
              <div>
                <p className="text-xs text-muted-foreground">Total no período</p>
                <p className="text-lg font-semibold">{formatCurrencyBRL(total)}</p>
              </div>
            </CardContent>
          </Card>
          <Can code="financial.register_expense">
            <Button onClick={openCreate}>
              <Plus />
              Nova despesa
            </Button>
          </Can>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição..."
            className="pl-9"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>
        {searchInput && (
          <Button variant="ghost" size="sm" onClick={() => setSearchInput("")}>
            <X />
            Limpar
          </Button>
        )}
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={CATEGORY_ALL}>Todas as categorias</SelectItem>
            {EXPENSE_CATEGORY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={period} onValueChange={(value) => setPeriod(value as ReportPeriod)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertCircle className="size-8 text-destructive" />
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar as despesas. Tente novamente.
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : isEmpty ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <TrendingDown className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhuma despesa no período.
            </p>
            <Can code="financial.register_expense">
              <Button size="sm" onClick={openCreate}>
                <Plus />
                Nova despesa
              </Button>
            </Can>
          </CardContent>
        </Card>
      ) : (
        <ResponsiveDataView
          items={expenses}
          getKey={(e) => e.id}
          renderCard={(e) => (
            <ExpenseMobileCard
              expense={e}
              onEdit={canManage ? openEdit : undefined}
              onDelete={
                canManage ? (ex) => deleteMutation.mutate(ex.id) : undefined
              }
              deleting={deleteMutation.isPending}
            />
          )}
          table={
            <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Forma</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-0 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="text-muted-foreground">
                    {formatBrDate(expense.incurred_at)}
                  </TableCell>
                  <TableCell className="font-medium">{expense.description}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {expense.category_display}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {expense.method_display}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrencyBRL(Number(expense.amount))}
                  </TableCell>
                  <TableCell className="text-right">
                    <Can code="financial.register_expense">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Editar despesa"
                          aria-label="Editar despesa"
                          onClick={() => openEdit(expense)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Excluir despesa"
                          aria-label="Excluir despesa"
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate(expense.id)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </Can>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
            </Card>
          }
        />
      )}

      {!isLoading && !isError && !isEmpty && (
        <Pagination
          page={page}
          pageSize={DEFAULT_PAGE_SIZE}
          count={data?.count ?? 0}
          onPageChange={setPage}
        />
      )}

      <ExpenseFormDialog
        key={editing?.id ?? "new"}
        expense={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
