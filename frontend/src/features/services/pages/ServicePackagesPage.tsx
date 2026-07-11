import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  AlertCircle,
  Info,
  Package,
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
import { Pagination } from "@/components/shared/Pagination";
import { extractErrorMessage } from "@/lib/api-client";
import { formatCurrencyBRL } from "@/lib/masks";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

import { deleteServicePackage, listServicePackagesPage, reactivateServicePackage } from "../api";
import { ServicesNav } from "../components/ServicesNav";
import { PACKAGE_STATUS_OPTIONS } from "../constants";
import { PackageFormSheet } from "../PackageFormSheet";
import type { ServicePackage, ServiceStatusFilter } from "../types";

const PACKAGES_QUERY_KEY = ["service-packages"];

export function ServicePackagesPage() {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const effectiveSearch = searchInput === "" ? "" : debouncedSearch;

  const [statusFilter, setStatusFilter] = useState<ServiceStatusFilter>("active");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServicePackage | null>(null);
  const [page, setPage] = useState(1);
  // Voltar para a 1ª página sempre que o filtro/busca muda (senão você poderia
  // ficar numa página que não existe mais no resultado filtrado).
  useEffect(() => {
    setPage(1);
  }, [effectiveSearch, statusFilter]);

  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [...PACKAGES_QUERY_KEY, page, effectiveSearch, statusFilter],
    queryFn: () =>
      listServicePackagesPage(page, { search: effectiveSearch || undefined, status: statusFilter }),
    // Mantém a página anterior visível enquanto a próxima carrega (sem "piscar").
    placeholderData: keepPreviousData,
  });
  const packages = data?.results;

  const deleteMutation = useMutation({
    mutationFn: deleteServicePackage,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: PACKAGES_QUERY_KEY });
      toast.success("Pacote excluído.");
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, "Não foi possível excluir o pacote."));
      setDeleteTarget(null);
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: reactivateServicePackage,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: PACKAGES_QUERY_KEY });
      toast.success("Pacote reativado.");
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, "Não foi possível reativar o pacote."));
    },
  });

  const isEmpty = (data?.count ?? 0) === 0;

  function openCreateSheet() {
    setEditingPackageId(null);
    setSheetOpen(true);
  }

  function openEditSheet(id: number) {
    setEditingPackageId(id);
    setSheetOpen(true);
  }

  return (
    <div className="space-y-6">
      <ServicesNav />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pacotes de Serviços</h1>
          <p className="text-muted-foreground">
            Agrupe serviços cadastrados para facilitar venda e orçamento.
          </p>
        </div>
        <Can code="packages.create"><Button onClick={openCreateSheet}>
          <Plus />
          Novo pacote
        </Button></Can>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar pacote pelo nome..."
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
          onValueChange={(value) => setStatusFilter(value as ServiceStatusFilter)}
        >
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PACKAGE_STATUS_OPTIONS.map((option) => (
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
          <span>Estes pacotes estão desabilitados e não aparecem na listagem padrão.</span>
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
              Não foi possível carregar os pacotes. Tente novamente.
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : isEmpty ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Package className="size-8 text-muted-foreground" />
            {effectiveSearch ? (
              <p className="text-sm text-muted-foreground">
                Nenhum pacote encontrado para "{effectiveSearch}".
              </p>
            ) : statusFilter === "inactive" ? (
              <p className="text-sm text-muted-foreground">Nenhum pacote desabilitado.</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Nenhum pacote cadastrado ainda.</p>
                <Can code="packages.create"><Button size="sm" onClick={openCreateSheet}>
                  <Plus />
                  Novo pacote
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
                <TableHead>Serviços</TableHead>
                <TableHead>Valor final</TableHead>
                <TableHead className="w-0 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packages?.map((pkg) => (
                <TableRow key={pkg.id}>
                  <TableCell className="font-medium">{pkg.name}</TableCell>
                  <TableCell className="text-muted-foreground">{pkg.items.length}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatCurrencyBRL(Number(pkg.final_value))}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar pacote"
                        aria-label="Editar pacote"
                        onClick={() => openEditSheet(pkg.id)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      {statusFilter !== "inactive" ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Excluir pacote"
                          aria-label="Excluir pacote"
                          onClick={() => setDeleteTarget(pkg)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Reativar pacote"
                          aria-label="Reativar pacote"
                          disabled={reactivateMutation.isPending}
                          onClick={() => reactivateMutation.mutate(pkg.id)}
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

      <PackageFormSheet open={sheetOpen} onOpenChange={setSheetOpen} packageId={editingPackageId} />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pacote?</AlertDialogTitle>
            <AlertDialogDescription>
              O pacote "{deleteTarget?.name}" será desabilitado e deixará de aparecer na listagem
              padrão. O histórico é preservado e ele pode ser reativado depois.
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
