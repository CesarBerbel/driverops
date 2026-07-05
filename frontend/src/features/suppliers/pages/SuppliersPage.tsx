import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Info, Pencil, Plus, RotateCcw, Search, Trash2, Truck, X } from "lucide-react";
import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Can } from "@/features/auth/Can";
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
import { extractErrorMessage } from "@/lib/api-client";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

import { deleteSupplier, listSuppliers, reactivateSupplier } from "../api";
import { SUPPLIER_STATUS_OPTIONS, SUPPLIER_TYPE_OPTIONS } from "../constants";
import { SupplierFormSheet } from "../SupplierFormSheet";
import type { Supplier, SupplierStatusFilter } from "../types";

const SUPPLIERS_QUERY_KEY = ["suppliers"];

const SUPPLIER_TYPE_LABELS = Object.fromEntries(
  SUPPLIER_TYPE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<Supplier["supplier_type"], string>;

export function SuppliersPage() {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const effectiveSearch = searchInput === "" ? "" : debouncedSearch;

  const [statusFilter, setStatusFilter] = useState<SupplierStatusFilter>("active");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  const queryClient = useQueryClient();

  const {
    data: suppliers,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [...SUPPLIERS_QUERY_KEY, effectiveSearch, statusFilter],
    queryFn: () => listSuppliers({ search: effectiveSearch || undefined, status: statusFilter }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SUPPLIERS_QUERY_KEY });
      toast.success("Fornecedor excluído.");
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, "Não foi possível excluir o fornecedor."));
      setDeleteTarget(null);
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: reactivateSupplier,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SUPPLIERS_QUERY_KEY });
      toast.success("Fornecedor reativado.");
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, "Não foi possível reativar o fornecedor."));
    },
  });

  const isEmpty = (suppliers?.length ?? 0) === 0;

  function openCreateSheet() {
    setEditingSupplierId(null);
    setSheetOpen(true);
  }

  function openEditSheet(id: number) {
    setEditingSupplierId(id);
    setSheetOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fornecedores</h1>
          <p className="text-muted-foreground">Cadastre os fornecedores de peças do sistema.</p>
        </div>
        <Can code="suppliers.create"><Button onClick={openCreateSheet}>
          <Plus />
          Novo fornecedor
        </Button></Can>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, nome fantasia ou documento..."
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
          onValueChange={(value) => setStatusFilter(value as SupplierStatusFilter)}
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPLIER_STATUS_OPTIONS.map((option) => (
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
            Estes fornecedores estão desabilitados e não estão disponíveis para novos vínculos com
            peças.
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
              Não foi possível carregar os fornecedores. Tente novamente.
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : isEmpty ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Truck className="size-8 text-muted-foreground" />
            {effectiveSearch ? (
              <p className="text-sm text-muted-foreground">
                Nenhum fornecedor encontrado para "{effectiveSearch}".
              </p>
            ) : statusFilter === "inactive" ? (
              <p className="text-sm text-muted-foreground">Nenhum fornecedor desabilitado.</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Nenhum fornecedor cadastrado ainda.</p>
                <Can code="suppliers.create"><Button size="sm" onClick={openCreateSheet}>
                  <Plus />
                  Novo fornecedor
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
                <TableHead>Nome/Razão social</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="w-0 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers?.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">
                    {supplier.name}
                    {supplier.trade_name && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {supplier.trade_name}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {SUPPLIER_TYPE_LABELS[supplier.supplier_type]}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {supplier.document || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{supplier.phone || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Editar fornecedor"
                        onClick={() => openEditSheet(supplier.id)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      {statusFilter !== "inactive" ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Excluir fornecedor"
                          onClick={() => setDeleteTarget(supplier)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Reativar fornecedor"
                          disabled={reactivateMutation.isPending}
                          onClick={() => reactivateMutation.mutate(supplier.id)}
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

      <SupplierFormSheet open={sheetOpen} onOpenChange={setSheetOpen} supplierId={editingSupplierId} />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fornecedor?</AlertDialogTitle>
            <AlertDialogDescription>
              O fornecedor "{deleteTarget?.name}" será desabilitado e deixará de aparecer na
              listagem padrão e nos vínculos de novas peças. O histórico é preservado e ele pode
              ser reativado depois.
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
