import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Info, Pencil, Plus, RotateCcw, Search, Trash2, Wrench, X } from "lucide-react";
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
import { listCategories } from "@/features/categories/api";
import { extractErrorMessage } from "@/lib/api-client";
import { formatCurrencyBRL } from "@/lib/masks";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

import { deleteService, listServices, reactivateService } from "../api";
import { ServicesNav } from "../components/ServicesNav";
import { SERVICE_STATUS_OPTIONS } from "../constants";
import { ServiceFormSheet } from "../ServiceFormSheet";
import type { Service, ServiceStatusFilter } from "../types";

const SERVICES_QUERY_KEY = ["services"];
const ALL_CATEGORIES = "all";

export function ServicesPage() {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const effectiveSearch = searchInput === "" ? "" : debouncedSearch;

  const [statusFilter, setStatusFilter] = useState<ServiceStatusFilter>("active");
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL_CATEGORIES);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);

  const queryClient = useQueryClient();

  const { data: categories } = useQuery({
    queryKey: ["categories", "service", "active"],
    queryFn: () => listCategories("service", "active"),
  });

  const {
    data: services,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [...SERVICES_QUERY_KEY, effectiveSearch, statusFilter, categoryFilter],
    queryFn: () =>
      listServices({
        search: effectiveSearch || undefined,
        status: statusFilter,
        category: categoryFilter === ALL_CATEGORIES ? undefined : Number(categoryFilter),
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteService,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SERVICES_QUERY_KEY });
      toast.success("Serviço excluído.");
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, "Não foi possível excluir o serviço."));
      setDeleteTarget(null);
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: reactivateService,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SERVICES_QUERY_KEY });
      toast.success("Serviço reativado.");
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, "Não foi possível reativar o serviço."));
    },
  });

  const isEmpty = (services?.length ?? 0) === 0;

  function openCreateSheet() {
    setEditingServiceId(null);
    setSheetOpen(true);
  }

  function openEditSheet(id: number) {
    setEditingServiceId(id);
    setSheetOpen(true);
  }

  return (
    <div className="space-y-6">
      <ServicesNav />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Serviços</h1>
          <p className="text-muted-foreground">Cadastre e gerencie os serviços oferecidos.</p>
        </div>
        <Button onClick={openCreateSheet}>
          <Plus />
          Novo serviço
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou categoria..."
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
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CATEGORIES}>Todas as categorias</SelectItem>
            {categories?.map((category) => (
              <SelectItem key={category.id} value={String(category.id)}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as ServiceStatusFilter)}
        >
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SERVICE_STATUS_OPTIONS.map((option) => (
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
            Estes serviços estão desabilitados e não estão disponíveis para novos pacotes.
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
              Não foi possível carregar os serviços. Tente novamente.
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : isEmpty ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Wrench className="size-8 text-muted-foreground" />
            {effectiveSearch ? (
              <p className="text-sm text-muted-foreground">
                Nenhum serviço encontrado para "{effectiveSearch}".
              </p>
            ) : statusFilter === "inactive" ? (
              <p className="text-sm text-muted-foreground">Nenhum serviço desabilitado.</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Nenhum serviço cadastrado ainda.</p>
                <Button size="sm" onClick={openCreateSheet}>
                  <Plus />
                  Novo serviço
                </Button>
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
                <TableHead>Valor</TableHead>
                <TableHead className="w-0 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services?.map((service) => (
                <TableRow key={service.id}>
                  <TableCell className="font-medium">{service.name}</TableCell>
                  <TableCell className="text-muted-foreground">{service.category_name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatCurrencyBRL(Number(service.value))}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Editar serviço"
                        onClick={() => openEditSheet(service.id)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      {statusFilter !== "inactive" ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Excluir serviço"
                          onClick={() => setDeleteTarget(service)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Reativar serviço"
                          disabled={reactivateMutation.isPending}
                          onClick={() => reactivateMutation.mutate(service.id)}
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

      <ServiceFormSheet open={sheetOpen} onOpenChange={setSheetOpen} serviceId={editingServiceId} />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              O serviço "{deleteTarget?.name}" será desabilitado e deixará de aparecer na listagem
              padrão e nos vínculos de novos pacotes. O histórico é preservado e ele pode ser
              reativado depois.
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
