import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { CurrencyInput } from "@/components/shared/CurrencyInput";
import { SupplierCombobox } from "@/components/shared/SupplierCombobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { listCategories } from "@/features/categories/api";
import { CategoryQuickCreateDialog } from "@/features/categories/components/CategoryQuickCreateDialog";
import type { Category } from "@/features/categories/types";
import { SupplierQuickCreateDialog } from "@/features/suppliers/components/SupplierQuickCreateDialog";
import type { Supplier } from "@/features/suppliers/types";
import { extractErrorMessage } from "@/lib/api-client";
import {
  formatCurrencyBRL,
  formatNCM,
  normalizeNCM,
  onlyDigits,
  parseCurrencyBRL,
  parseQuantityBRL,
} from "@/lib/masks";

import { createPart, updatePart } from "../api";
import { UNIT_OF_MEASURE_OPTIONS } from "../constants";
import { partSchema, type PartFormValues } from "../schemas";
import type { Part, PartPayload } from "../types";

const EMPTY_VALUES: PartFormValues = {
  category_id: null,
  name: "",
  internal_code: "",
  brand: "",
  model_application: "",
  unit_of_measure: "unit",
  current_quantity: "0",
  min_quantity: "",
  cost_price: "",
  sale_price: "",
  location: "",
  supplier_id: null,
  ncm: "",
  barcode: "",
  notes: "",
};

function sanitizeQuantityInput(value: string): string {
  const cleaned = value.replace(/[^\d,]/g, "");
  const firstComma = cleaned.indexOf(",");
  if (firstComma === -1) return cleaned;
  return cleaned.slice(0, firstComma + 1) + cleaned.slice(firstComma + 1).replace(/,/g, "");
}

function toFormValues(part: Part): PartFormValues {
  return {
    category_id: part.category,
    name: part.name,
    internal_code: part.internal_code,
    brand: part.brand,
    model_application: part.model_application,
    unit_of_measure: part.unit_of_measure,
    current_quantity: part.current_quantity.replace(".", ","),
    min_quantity: part.min_quantity ? part.min_quantity.replace(".", ",") : "",
    cost_price: part.cost_price ? formatCurrencyBRL(Number(part.cost_price)) : "",
    sale_price: part.sale_price ? formatCurrencyBRL(Number(part.sale_price)) : "",
    location: part.location,
    supplier_id: part.supplier,
    ncm: part.ncm,
    barcode: part.barcode,
    notes: part.notes,
  };
}

function toPayload(values: PartFormValues): Partial<PartPayload> {
  return {
    category: values.category_id as number,
    name: values.name,
    internal_code: values.internal_code,
    brand: values.brand,
    model_application: values.model_application,
    unit_of_measure: values.unit_of_measure as PartPayload["unit_of_measure"],
    current_quantity: String(parseQuantityBRL(values.current_quantity) ?? 0),
    min_quantity: values.min_quantity ? String(parseQuantityBRL(values.min_quantity)) : null,
    cost_price: values.cost_price ? String(parseCurrencyBRL(values.cost_price)) : null,
    sale_price: values.sale_price ? String(parseCurrencyBRL(values.sale_price)) : null,
    location: values.location,
    supplier: values.supplier_id,
    ncm: values.ncm,
    barcode: values.barcode,
    notes: values.notes,
  };
}

interface PartFormProps {
  part: Part | null;
  onSuccess: (part: Part) => void;
  onCancel?: () => void;
}

export function PartForm({ part, onSuccess, onCancel }: PartFormProps) {
  const queryClient = useQueryClient();
  const isEditMode = part !== null;
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [supplierName, setSupplierName] = useState(part?.supplier_name ?? "");

  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PartFormValues>({
    resolver: zodResolver(partSchema),
    defaultValues: part ? toFormValues(part) : EMPTY_VALUES,
  });

  const { data: categories } = useQuery({
    queryKey: ["categories", "part", "active"],
    queryFn: () => listCategories("part", "active"),
  });

  const mutation = useMutation({
    mutationFn: (values: PartFormValues) => {
      const payload = toPayload(values);
      return isEditMode ? updatePart(part.id, payload) : createPart(payload);
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["parts"] });
      toast.success(isEditMode ? "Peça atualizada." : "Peça criada.");
      onSuccess(saved);
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, "Não foi possível salvar a peça."));
    },
  });

  function handleCategoryCreated(category: Category) {
    queryClient.invalidateQueries({ queryKey: ["categories", "part", "active"] });
    setValue("category_id", category.id, { shouldValidate: true, shouldDirty: true });
  }

  function handleSelectSupplier(supplier: Supplier) {
    setValue("supplier_id", supplier.id, { shouldValidate: true, shouldDirty: true });
    setSupplierName(supplier.name);
  }

  function handleClearSupplier() {
    setValue("supplier_id", null, { shouldValidate: true, shouldDirty: true });
    setSupplierName("");
  }

  function handleSupplierCreated(supplier: Supplier) {
    setValue("supplier_id", supplier.id, { shouldValidate: true, shouldDirty: true });
    setSupplierName(supplier.name);
  }

  return (
    <form
      onSubmit={(event) => {
        // This form can be nested (via PartQuickCreateDialog's Radix Portal)
        // inside another <form> in the React tree -- e.g. the service cadastro's
        // own form. React re-dispatches bubbling events along the *component*
        // tree for portaled content, so without stopPropagation here, submitting
        // this form would also fire the ancestor form's onSubmit.
        event.stopPropagation();
        handleSubmit((values) => mutation.mutate(values))(event);
      }}
      className="flex flex-1 flex-col overflow-hidden"
      noValidate
    >
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="part-category_id">Categoria da peça</Label>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => setCategoryDialogOpen(true)}
                >
                  <Plus className="size-3" />
                  Adicionar categoria
                </Button>
              </div>
              <Controller
                control={control}
                name="category_id"
                render={({ field }) => (
                  <Select
                    value={field.value !== null ? String(field.value) : ""}
                    onValueChange={(value) => {
                      if (value) field.onChange(Number(value));
                    }}
                  >
                    <SelectTrigger
                      id="part-category_id"
                      className="w-full"
                      aria-invalid={Boolean(errors.category_id)}
                    >
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((category) => (
                        <SelectItem key={category.id} value={String(category.id)}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.category_id && (
                <p className="text-sm text-destructive">{errors.category_id.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identificação</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="part-name">Nome da peça</Label>
              <Input id="part-name" aria-invalid={Boolean(errors.name)} {...register("name")} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="part-internal_code">Código interno</Label>
              <Input id="part-internal_code" placeholder="PC-1234" {...register("internal_code")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="part-brand">Marca</Label>
              <Input id="part-brand" placeholder="Bosch" {...register("brand")} />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="part-model_application">Modelo/aplicação</Label>
              <Input
                id="part-model_application"
                placeholder="Gol G5 1.6"
                {...register("model_application")}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estoque</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="part-unit_of_measure">Unidade de medida</Label>
              <Controller
                control={control}
                name="unit_of_measure"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="part-unit_of_measure" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_OF_MEASURE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="part-current_quantity">Quantidade atual</Label>
              <Controller
                control={control}
                name="current_quantity"
                render={({ field }) => (
                  <Input
                    id="part-current_quantity"
                    inputMode="decimal"
                    value={field.value}
                    onChange={(event) => field.onChange(sanitizeQuantityInput(event.target.value))}
                    aria-invalid={Boolean(errors.current_quantity)}
                  />
                )}
              />
              {errors.current_quantity && (
                <p className="text-sm text-destructive">{errors.current_quantity.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="part-min_quantity">Estoque mínimo</Label>
              <Controller
                control={control}
                name="min_quantity"
                render={({ field }) => (
                  <Input
                    id="part-min_quantity"
                    inputMode="decimal"
                    value={field.value}
                    onChange={(event) => field.onChange(sanitizeQuantityInput(event.target.value))}
                    aria-invalid={Boolean(errors.min_quantity)}
                  />
                )}
              />
              {errors.min_quantity && (
                <p className="text-sm text-destructive">{errors.min_quantity.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preços</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="part-cost_price">Preço de custo</Label>
              <Controller
                control={control}
                name="cost_price"
                render={({ field }) => (
                  <CurrencyInput
                    id="part-cost_price"
                    value={field.value}
                    onChange={field.onChange}
                    aria-invalid={Boolean(errors.cost_price)}
                  />
                )}
              />
              {errors.cost_price && (
                <p className="text-sm text-destructive">{errors.cost_price.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="part-sale_price">Preço de venda</Label>
              <Controller
                control={control}
                name="sale_price"
                render={({ field }) => (
                  <CurrencyInput
                    id="part-sale_price"
                    value={field.value}
                    onChange={field.onChange}
                    aria-invalid={Boolean(errors.sale_price)}
                  />
                )}
              />
              {errors.sale_price && (
                <p className="text-sm text-destructive">{errors.sale_price.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Outros dados</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="part-location">Localização no estoque</Label>
              <Input id="part-location" placeholder="Prateleira A3" {...register("location")} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="part-supplier_id">Fornecedor</Label>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => setSupplierDialogOpen(true)}
                >
                  <Plus className="size-3" />
                  Adicionar fornecedor
                </Button>
              </div>
              <SupplierCombobox
                selectedName={supplierName}
                onSelect={handleSelectSupplier}
                onClear={handleClearSupplier}
                invalid={Boolean(errors.supplier_id)}
              />
              {errors.supplier_id && (
                <p className="text-sm text-destructive">{errors.supplier_id.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="part-ncm">NCM</Label>
              <Controller
                control={control}
                name="ncm"
                render={({ field }) => (
                  <Input
                    id="part-ncm"
                    placeholder="8708.99.90"
                    value={formatNCM(field.value ?? "")}
                    onChange={(event) => field.onChange(normalizeNCM(event.target.value))}
                  />
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="part-barcode">Código de barras</Label>
              <Controller
                control={control}
                name="barcode"
                render={({ field }) => (
                  <Input
                    id="part-barcode"
                    inputMode="numeric"
                    value={field.value}
                    onChange={(event) => field.onChange(onlyDigits(event.target.value))}
                  />
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea id="part-notes" rows={4} {...register("notes")} />
          </CardContent>
        </Card>
      </div>

      <div className="flex shrink-0 flex-row justify-end gap-2 border-t p-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting || mutation.isPending}>
          {(isSubmitting || mutation.isPending) && <Loader2 className="animate-spin" />}
          Salvar
        </Button>
      </div>

      <CategoryQuickCreateDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        categoryType="part"
        onCreated={handleCategoryCreated}
      />

      <SupplierQuickCreateDialog
        open={supplierDialogOpen}
        onOpenChange={setSupplierDialogOpen}
        onCreated={handleSupplierCreated}
      />
    </form>
  );
}
