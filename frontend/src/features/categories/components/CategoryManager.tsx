import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Info, Pencil, Plus, RotateCcw, Tag, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

import { deleteCategory, listCategories, reactivateCategory } from "../api";
import type { Category, CategoryStatusFilter, CategoryType } from "../types";
import { CategoryForm } from "./CategoryForm";

const STATUS_OPTIONS: { value: CategoryStatusFilter; label: string }[] = [
  { value: "active", label: "Categorias habilitadas" },
  { value: "inactive", label: "Categorias desabilitadas" },
  { value: "all", label: "Todas" },
];

const CATEGORIES_QUERY_KEY = ["categories"];

interface CategoryManagerProps {
  categoryType: CategoryType;
  title: string;
  description: string;
}

export function CategoryManager({ categoryType, title, description }: CategoryManagerProps) {
  const [statusFilter, setStatusFilter] = useState<CategoryStatusFilter>("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const queryClient = useQueryClient();

  const { data: categories, isLoading } = useQuery({
    queryKey: [...CATEGORIES_QUERY_KEY, categoryType, statusFilter],
    queryFn: () => listCategories(categoryType, statusFilter),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
      toast.success("Categoria excluída.");
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, "Não foi possível excluir a categoria."));
      setDeleteTarget(null);
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: reactivateCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
      toast.success("Categoria reativada.");
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, "Não foi possível reativar a categoria."));
    },
  });

  function openCreateDialog() {
    setEditingCategory(null);
    setDialogOpen(true);
  }

  function openEditDialog(category: Category) {
    setEditingCategory(category);
    setDialogOpen(true);
  }

  const isEmpty = (categories?.length ?? 0) === 0;

  return (
    <div className="space-y-6">
      <Link
        to="/settings"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Configurações
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus />
          Nova categoria
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as CategoryStatusFilter)}
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
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
            Estas categorias estão desabilitadas e não estão disponíveis para novos cadastros.
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : isEmpty ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Tag className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {statusFilter === "inactive"
                ? "Nenhuma categoria desabilitada."
                : "Nenhuma categoria cadastrada ainda."}
            </p>
            {statusFilter !== "inactive" && (
              <Button size="sm" onClick={openCreateDialog}>
                <Plus />
                Nova categoria
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-0 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories?.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {category.description || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar categoria"
                        aria-label="Editar categoria"
                        onClick={() => openEditDialog(category)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      {category.is_active ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Excluir categoria"
                          aria-label="Excluir categoria"
                          onClick={() => setDeleteTarget(category)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Reativar categoria"
                          aria-label="Reativar categoria"
                          disabled={reactivateMutation.isPending}
                          onClick={() => reactivateMutation.mutate(category.id)}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Editar categoria" : "Nova categoria"}</DialogTitle>
          </DialogHeader>
          <CategoryForm
            key={editingCategory?.id ?? "create"}
            category={editingCategory}
            categoryType={categoryType}
            allowAddAnother={editingCategory === null}
            onSuccess={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              A categoria "{deleteTarget?.name}" será desabilitada e deixará de aparecer na
              listagem padrão. O histórico de registros que já utilizam essa categoria é
              preservado, e ela pode ser reativada depois.
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
