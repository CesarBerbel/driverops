import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { extractErrorMessage } from "@/lib/api-client";

import { createCategory, updateCategory } from "../api";
import { categorySchema, type CategoryFormValues } from "../schemas";
import type { Category, CategoryType } from "../types";

interface CategoryFormProps {
  category: Category | null;
  categoryType: CategoryType;
  onSuccess: (category: Category) => void;
}

export function CategoryForm({ category, categoryType, onSuccess }: CategoryFormProps) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name ?? "",
      description: category?.description ?? "",
      notes: category?.notes ?? "",
    },
  });

  async function onSubmit(values: CategoryFormValues) {
    try {
      let saved: Category;
      if (category) {
        saved = await updateCategory(category.id, values);
        toast.success("Categoria atualizada.");
      } else {
        saved = await createCategory({ ...values, category_type: categoryType });
        toast.success("Categoria criada.");
      }
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      onSuccess(saved);
    } catch (error) {
      const message = extractErrorMessage(error, "Não foi possível salvar a categoria.");
      setError("name", { message });
    }
  }

  return (
    <form
      onSubmit={(event) => {
        // This form can be nested (via CategoryQuickCreateDialog's Radix
        // Portal) inside another <form> in the React tree -- e.g. the part
        // cadastro's own form. React re-dispatches bubbling events along the
        // *component* tree for portaled content, so without stopPropagation
        // here, submitting this form would also fire the ancestor form's
        // onSubmit with whatever state it had at that moment.
        event.stopPropagation();
        handleSubmit(onSubmit)(event);
      }}
      className="space-y-4"
      noValidate
    >
      <div className="space-y-2">
        <Label htmlFor="category-name">Nome</Label>
        <Input
          id="category-name"
          aria-invalid={Boolean(errors.name)}
          {...register("name")}
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="category-description">Descrição (opcional)</Label>
        <Input id="category-description" {...register("description")} />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="category-notes">Observações (opcional)</Label>
        <Textarea id="category-notes" {...register("notes")} />
        {errors.notes && <p className="text-sm text-destructive">{errors.notes.message}</p>}
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          Salvar
        </Button>
      </DialogFooter>
    </form>
  );
}
