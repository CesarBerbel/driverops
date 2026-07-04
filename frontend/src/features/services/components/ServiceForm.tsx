import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";

import { CurrencyInput } from "@/components/shared/CurrencyInput";
import { PartCombobox } from "@/components/shared/PartCombobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { listCategories } from "@/features/categories/api";
import { CategoryQuickCreateDialog } from "@/features/categories/components/CategoryQuickCreateDialog";
import type { Category } from "@/features/categories/types";
import { PartQuickCreateDialog } from "@/features/parts/components/PartQuickCreateDialog";
import type { Part } from "@/features/parts/types";
import { extractErrorMessage } from "@/lib/api-client";
import { formatCurrencyBRL, onlyDigits, parseCurrencyBRL, parseQuantityBRL } from "@/lib/masks";

import { createService, updateService } from "../api";
import { serviceSchema, type ServiceFormValues } from "../schemas";
import type { Service, ServicePayload } from "../types";

const EMPTY_VALUES: ServiceFormValues = {
  name: "",
  category_id: null,
  description: "",
  labor_cost: "R$ 0,00",
  estimated_minutes: "",
  notes: "",
  standard_parts: [],
};

function sanitizeQuantityInput(value: string): string {
  const cleaned = value.replace(/[^\d,]/g, "");
  const firstComma = cleaned.indexOf(",");
  if (firstComma === -1) return cleaned;
  return cleaned.slice(0, firstComma + 1) + cleaned.slice(firstComma + 1).replace(/,/g, "");
}

function toFormValues(service: Service): ServiceFormValues {
  return {
    name: service.name,
    category_id: service.category,
    description: service.description,
    labor_cost: formatCurrencyBRL(Number(service.labor_cost)),
    estimated_minutes:
      service.estimated_minutes !== null ? String(service.estimated_minutes) : "",
    notes: service.notes,
    standard_parts: service.standard_parts.map((sp) => ({
      part_id: sp.part,
      part_name: sp.part_name,
      suggested_quantity: sp.suggested_quantity.replace(".", ","),
    })),
  };
}

function toPayload(values: ServiceFormValues): Partial<ServicePayload> {
  return {
    name: values.name,
    category: values.category_id as number,
    description: values.description ?? "",
    labor_cost: String(parseCurrencyBRL(values.labor_cost) ?? 0),
    estimated_minutes: values.estimated_minutes ? Number(onlyDigits(values.estimated_minutes)) : null,
    notes: values.notes ?? "",
    standard_parts: values.standard_parts.map((sp) => ({
      part: sp.part_id,
      suggested_quantity: String(parseQuantityBRL(sp.suggested_quantity) ?? 0),
    })),
  };
}

interface ServiceFormProps {
  service: Service | null;
  onSuccess: (service: Service) => void;
  onCancel?: () => void;
  // Show a "Salvar e adicionar outro" action (standalone create only).
  allowAddAnother?: boolean;
}

export function ServiceForm({
  service,
  onSuccess,
  onCancel,
  allowAddAnother,
}: ServiceFormProps) {
  const queryClient = useQueryClient();
  const isEditMode = service !== null;
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [partDialogOpen, setPartDialogOpen] = useState(false);
  const addAnotherRef = useRef(false);

  const {
    control,
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: service ? toFormValues(service) : EMPTY_VALUES,
  });

  const { fields, append, remove } = useFieldArray({ control, name: "standard_parts" });

  const { data: categories } = useQuery({
    queryKey: ["categories", "service", "active"],
    queryFn: () => listCategories("service", "active"),
  });

  const mutation = useMutation({
    mutationFn: (values: ServiceFormValues) => {
      const payload = toPayload(values);
      return isEditMode ? updateService(service.id, payload) : createService(payload);
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["services"] });
      toast.success(isEditMode ? "Serviço atualizado." : "Serviço criado.", {
        id: "service-saved",
      });
      if (addAnotherRef.current) {
        addAnotherRef.current = false;
        reset(EMPTY_VALUES);
      } else {
        onSuccess(saved);
      }
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, "Não foi possível salvar o serviço."));
    },
  });

  function handleCategoryCreated(category: Category) {
    queryClient.invalidateQueries({ queryKey: ["categories", "service", "active"] });
    setValue("category_id", category.id, { shouldValidate: true, shouldDirty: true });
  }

  function addPart(part: Part) {
    append({ part_id: part.id, part_name: part.name, suggested_quantity: "1" });
  }

  const linkedPartIds = fields.map((f) => f.part_id);

  return (
    <form
      onSubmit={(event) => {
        // Nestable inside another <form> via a Dialog Portal -- stop the submit
        // from bubbling to an ancestor form. See PartForm for the full rationale.
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
                <Label htmlFor="service-category_id">Categoria do serviço</Label>
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
                      id="service-category_id"
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
              <Label htmlFor="service-name">Nome do serviço</Label>
              <Input id="service-name" aria-invalid={Boolean(errors.name)} {...register("name")} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-labor_cost">Valor de mão de obra</Label>
              <Controller
                control={control}
                name="labor_cost"
                render={({ field }) => (
                  <CurrencyInput
                    id="service-labor_cost"
                    value={field.value}
                    onChange={field.onChange}
                    aria-invalid={Boolean(errors.labor_cost)}
                  />
                )}
              />
              {errors.labor_cost && (
                <p className="text-sm text-destructive">{errors.labor_cost.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-estimated_minutes">Tempo estimado (minutos)</Label>
              <Controller
                control={control}
                name="estimated_minutes"
                render={({ field }) => (
                  <Input
                    id="service-estimated_minutes"
                    inputMode="numeric"
                    placeholder="Ex.: 90"
                    value={field.value ?? ""}
                    onChange={(event) => field.onChange(onlyDigits(event.target.value))}
                  />
                )}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="service-description">Descrição</Label>
              <Textarea id="service-description" rows={3} {...register("description")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Peças padrão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Vincular peça do estoque</Label>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => setPartDialogOpen(true)}
                >
                  <Plus className="size-3" />
                  Adicionar peça
                </Button>
              </div>
              <PartCombobox onSelect={addPart} excludeIds={linkedPartIds} />
            </div>

            {fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma peça padrão vinculada. Este passo é opcional.
              </p>
            ) : (
              <ul className="space-y-2">
                {fields.map((item, index) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-md border px-3 py-2"
                  >
                    <span className="flex-1 text-sm font-medium">{item.part_name}</span>
                    <div className="flex items-center gap-1">
                      <Label
                        htmlFor={`sp-qty-${index}`}
                        className="text-xs text-muted-foreground"
                      >
                        Qtd.
                      </Label>
                      <Controller
                        control={control}
                        name={`standard_parts.${index}.suggested_quantity`}
                        render={({ field }) => (
                          <Input
                            id={`sp-qty-${index}`}
                            inputMode="decimal"
                            className="h-8 w-24"
                            value={field.value}
                            onChange={(event) =>
                              field.onChange(sanitizeQuantityInput(event.target.value))
                            }
                            aria-invalid={Boolean(errors.standard_parts?.[index]?.suggested_quantity)}
                          />
                        )}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label="Remover peça"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Observações internas</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea id="service-notes" rows={4} {...register("notes")} />
          </CardContent>
        </Card>
      </div>

      <div className="flex shrink-0 flex-row justify-end gap-2 border-t p-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        {allowAddAnother && (
          <Button
            type="submit"
            variant="secondary"
            disabled={isSubmitting || mutation.isPending}
            onClick={() => {
              addAnotherRef.current = true;
            }}
          >
            Salvar e adicionar outro
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSubmitting || mutation.isPending}
          onClick={() => {
            addAnotherRef.current = false;
          }}
        >
          {(isSubmitting || mutation.isPending) && <Loader2 className="animate-spin" />}
          Salvar
        </Button>
      </div>

      <CategoryQuickCreateDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        categoryType="service"
        onCreated={handleCategoryCreated}
      />

      <PartQuickCreateDialog
        open={partDialogOpen}
        onOpenChange={setPartDialogOpen}
        onCreated={addPart}
      />
    </form>
  );
}
