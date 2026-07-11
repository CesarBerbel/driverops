import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeftRight,
  Boxes,
  Info,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Can } from "@/features/auth/Can";
import { usePermissionCheck } from "@/features/auth/usePermission";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/shared/Pagination";
import { extractErrorMessage } from "@/lib/api-client";
import { formatQuantityBRL } from "@/lib/masks";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

import { deletePart, listPartsPage, reactivatePart } from "../api";
import { StockMovementDialog } from "../components/StockMovementDialog";
import { PART_STATUS_OPTIONS, UNIT_OF_MEASURE_LABELS } from "../constants";
import { PartFormSheet } from "../PartFormSheet";
import type { Part, PartStatusFilter } from "../types";

const PARTS_QUERY_KEY = ["parts"];

export function PartsPage() {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const effectiveSearch = searchInput === "" ? "" : debouncedSearch;

  const [statusFilter, setStatusFilter] = useState<PartStatusFilter>("active");
  const [page, setPage] = useState(1);
  // Voltar para a 1ª página sempre que o filtro/busca muda (senão você poderia
  // ficar numa página que não existe mais no resultado filtrado).
  useEffect(() => {
    setPage(1);
  }, [effectiveSearch, statusFilter]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingPartId, setEditingPartId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Part | null>(null);
  const [movementTarget, setMovementTarget] = useState<Part | null>(null);

  const queryClient = useQueryClient();
  const can = usePermissionCheck();
  const canMoveStock = can("parts.stock_move") || can("parts.stock_adjust");

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [...PARTS_QUERY_KEY, page, effectiveSearch, statusFilter],
    queryFn: () => listPartsPage(page, effectiveSearch || undefined, statusFilter),
    // Mantém a página anterior visível enquanto a próxima carrega (sem "piscar").
    placeholderData: keepPreviousData,
  });
  const parts = data?.results;

  const deleteMutation = useMutation({
    mutationFn: deletePart,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: PARTS_QUERY_KEY });
      toast.success("Peça excluída.");
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, "Não foi possível excluir a peça."));
      setDeleteTarget(null);
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: reactivatePart,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: PARTS_QUERY_KEY });
      toast.success("Peça reativada.");
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, "Não foi possível reativar a peça."));
    },
  });

  const isEmpty = (data?.count ?? 0) === 0;

  function openCreateSheet() {
    setEditingPartId(null);
    setSheetOpen(true);
  }

  function openEditSheet(id: number) {
    setEditingPartId(id);
    setSheetOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Peças em Estoque</h1>
          <p className="text-muted-foreground">Cadastre e controle as peças em estoque.</p>
        </div>
        <Can code="parts.create"><Button onClick={openCreateSheet}>
          <Plus />
          Nova peça
        </Button></Can>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, código, categoria ou marca..."
            className="pl-9"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>
        {searchInput && (
          <Button variant="ghost" size="sm" onClick={() => setSearchInput("")}>
            <X />
            Limpar pesquisa
          </Button>
        )}
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as PartStatusFilter)}
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PART_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {statusFilter === "inactive" && (
        <div className="flex items-start gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>
            Estas peças estão desabilitadas e não estão disponíveis para novos vínculos.
          </span>
        </div>
      )}

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
              Não foi possível carregar as peças. Tente novamente.
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : isEmpty ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Boxes className="size-8 text-muted-foreground" />
            {effectiveSearch ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma peça encontrada para "{effectiveSearch}".
              </p>
            ) : statusFilter === "inactive" ? (
              <p className="text-sm text-muted-foreground">Nenhuma peça desabilitada.</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Nenhuma peça cadastrada ainda.</p>
                <Can code="parts.create"><Button size="sm" onClick={openCreateSheet}>
                  <Plus />
                  Nova peça
                </Button></Can>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>Estoque mínimo</TableHead>
                <TableHead className="w-0 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parts?.map((part) => (
                <TableRow key={part.id}>
                  <TableCell className="font-medium">{part.name}</TableCell>
                  <TableCell className="text-muted-foreground">{part.category_name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {part.supplier_name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span>
                        {formatQuantityBRL(Number(part.current_quantity))}{" "}
                        {UNIT_OF_MEASURE_LABELS[part.unit_of_measure]}
                      </span>
                      {part.is_low_stock && <Badge variant="muted">Estoque baixo</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {part.min_quantity !== null ? formatQuantityBRL(Number(part.min_quantity)) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {statusFilter !== "inactive" && canMoveStock && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Movimentar estoque"
                          aria-label="Movimentar estoque"
                          onClick={() => setMovementTarget(part)}
                        >
                          <ArrowLeftRight className="size-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar peça"
                        aria-label="Editar peça"
                        onClick={() => openEditSheet(part.id)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      {statusFilter !== "inactive" ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Excluir peça"
                          aria-label="Excluir peça"
                          onClick={() => setDeleteTarget(part)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Reativar peça"
                          aria-label="Reativar peça"
                          disabled={reactivateMutation.isPending}
                          onClick={() => reactivateMutation.mutate(part.id)}
                        >
                          <RotateCcw className="size-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {!isLoading && !isError && !isEmpty && (
        <Pagination
          page={page}
          pageSize={DEFAULT_PAGE_SIZE}
          count={data?.count ?? 0}
          onPageChange={setPage}
        />
      )}

      <PartFormSheet open={sheetOpen} onOpenChange={setSheetOpen} partId={editingPartId} />

      <StockMovementDialog
        open={movementTarget !== null}
        onOpenChange={(open) => !open && setMovementTarget(null)}
        part={movementTarget}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir peça?</AlertDialogTitle>
            <AlertDialogDescription>
              A peça "{deleteTarget?.name}" será desabilitada e deixará de aparecer na listagem
              padrão. O histórico é preservado e ela pode ser reativada depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
