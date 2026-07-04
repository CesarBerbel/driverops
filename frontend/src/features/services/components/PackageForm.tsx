import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { CurrencyInput } from "@/components/shared/CurrencyInput";
import { ServiceCombobox } from "@/components/shared/ServiceCombobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Service } from "@/features/services/types";
import { extractErrorMessage } from "@/lib/api-client";
import { formatCurrencyBRL, parseCurrencyBRL, parsePercent } from "@/lib/masks";

import { createServicePackage, updateServicePackage } from "../api";
import { DISCOUNT_TYPE_OPTIONS } from "../constants";
import { packageSchema, type PackageFormValues } from "../schemas";
import type { DiscountType, ServicePackage, ServicePackagePayload } from "../types";
import { ServiceQuickCreateDialog } from "./ServiceQuickCreateDialog";

const EMPTY_VALUES: PackageFormValues = {
  name: "",
  description: "",
  services: [],
  discount_type: "none",
  discount_value: "",
  notes: "",
};

function percentInput(value: string): string {
  const cleaned = value.replace(/[^\d,]/g, "");
  const firstComma = cleaned.indexOf(",");
  if (firstComma === -1) return cleaned;
  return cleaned.slice(0, firstComma + 1) + cleaned.slice(firstComma + 1).replace(/,/g, "");
}

function toFormValues(pkg: ServicePackage): PackageFormValues {
  return {
    name: pkg.name,
    description: pkg.description,
    services: pkg.items.map((item) => ({
      service_id: item.service,
      service_name: item.service_name,
      service_value: item.service_value,
    })),
    discount_type: pkg.discount_type,
    discount_value:
      pkg.discount_type === "percent"
        ? pkg.discount_value.replace(".", ",")
        : pkg.discount_type === "fixed"
          ? formatCurrencyBRL(Number(pkg.discount_value))
          : "",
    notes: pkg.notes,
  };
}

function toPayload(values: PackageFormValues): Partial<ServicePackagePayload> {
  let discountValue = "0";
  if (values.discount_type === "percent") {
    discountValue = String(parsePercent(values.discount_value) ?? 0);
  } else if (values.discount_type === "fixed") {
    discountValue = String(parseCurrencyBRL(values.discount_value) ?? 0);
  }
  return {
    name: values.name,
    description: values.description ?? "",
    discount_type: values.discount_type,
    discount_value: discountValue,
    notes: values.notes ?? "",
    items: values.services.map((s) => ({ service: s.service_id })),
  };
}

interface PackageFormProps {
  servicePackage: ServicePackage | null;
  onSuccess: (servicePackage: ServicePackage) => void;
  onCancel?: () => void;
  // Show a "Salvar e adicionar outro" action (standalone create only).
  allowAddAnother?: boolean;
}

export function PackageForm({
  servicePackage,
  onSuccess,
  onCancel,
  allowAddAnother,
}: PackageFormProps) {
  const queryClient = useQueryClient();
  const isEditMode = servicePackage !== null;
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const addAnotherRef = useRef(false);

  const {
    control,
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PackageFormValues>({
    resolver: zodResolver(packageSchema),
    defaultValues: servicePackage ? toFormValues(servicePackage) : EMPTY_VALUES,
  });

  const { fields, append, remove } = useFieldArray({ control, name: "services" });

  const watchedServices = useWatch({ control, name: "services" });
  const discountType = useWatch({ control, name: "discount_type" });
  const discountValue = useWatch({ control, name: "discount_value" });

  const total = (watchedServices ?? []).reduce(
    (sum, s) => sum + Number(s.service_value || 0),
    0,
  );
  let discount = 0;
  if (discountType === "percent") {
    discount = (total * (parsePercent(discountValue ?? "") ?? 0)) / 100;
  } else if (discountType === "fixed") {
    discount = parseCurrencyBRL(discountValue ?? "") ?? 0;
  }
  const final = Math.max(0, total - discount);

  const mutation = useMutation({
    mutationFn: (values: PackageFormValues) => {
      const payload = toPayload(values);
      return isEditMode
        ? updateServicePackage(servicePackage.id, payload)
        : createServicePackage(payload);
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["service-packages"] });
      toast.success(isEditMode ? "Pacote atualizado." : "Pacote criado.");
      if (addAnotherRef.current) {
        addAnotherRef.current = false;
        reset(EMPTY_VALUES);
      } else {
        onSuccess(saved);
      }
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, "Não foi possível salvar o pacote."));
    },
  });

  function addService(service: Service) {
    append({
      service_id: service.id,
      service_name: service.name,
      service_value: service.value,
    });
  }

  function handleDiscountTypeChange(value: DiscountType) {
    setValue("discount_type", value, { shouldDirty: true });
    setValue("discount_value", "", { shouldDirty: true });
  }

  const linkedServiceIds = fields.map((f) => f.service_id);

  return (
    <form
      onSubmit={(event) => {
        event.stopPropagation();
        handleSubmit((values) => mutation.mutate(values))(event);
      }}
      className="flex flex-1 flex-col overflow-hidden"
      noValidate
    >
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identificação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do pacote</Label>
              <Input id="name" aria-invalid={Boolean(errors.name)} {...register("name")} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea id="description" rows={3} {...register("description")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Serviços do pacote</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Vincular serviço</Label>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => setServiceDialogOpen(true)}
                >
                  <Plus className="size-3" />
                  Adicionar serviço
                </Button>
              </div>
              <ServiceCombobox
                onSelect={addService}
                excludeIds={linkedServiceIds}
                invalid={Boolean(errors.services)}
              />
              {errors.services && (
                <p className="text-sm text-destructive">{errors.services.message}</p>
              )}
            </div>

            {fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum serviço adicionado ainda.</p>
            ) : (
              <ul className="space-y-2">
                {fields.map((item, index) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-md border px-3 py-2"
                  >
                    <span className="flex-1 text-sm font-medium">{item.service_name}</span>
                    <span className="text-sm text-muted-foreground">
                      {formatCurrencyBRL(Number(item.service_value))}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label="Remover serviço"
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
            <CardTitle className="text-base">Valores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Valor total</span>
              <span className="font-medium" data-testid="package-total">
                {formatCurrencyBRL(total)}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="discount_type">Tipo de desconto</Label>
                <Controller
                  control={control}
                  name="discount_type"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(value) => handleDiscountTypeChange(value as DiscountType)}
                    >
                      <SelectTrigger id="discount_type" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DISCOUNT_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {discountType === "percent" && (
                <div className="space-y-2">
                  <Label htmlFor="discount_value">Desconto (%)</Label>
                  <Controller
                    control={control}
                    name="discount_value"
                    render={({ field }) => (
                      <Input
                        id="discount_value"
                        inputMode="decimal"
                        placeholder="0"
                        value={field.value}
                        onChange={(event) => field.onChange(percentInput(event.target.value))}
                        aria-invalid={Boolean(errors.discount_value)}
                      />
                    )}
                  />
                  {errors.discount_value && (
                    <p className="text-sm text-destructive">{errors.discount_value.message}</p>
                  )}
                </div>
              )}

              {discountType === "fixed" && (
                <div className="space-y-2">
                  <Label htmlFor="discount_value">Desconto (R$)</Label>
                  <Controller
                    control={control}
                    name="discount_value"
                    render={({ field }) => (
                      <CurrencyInput
                        id="discount_value"
                        value={field.value}
                        onChange={field.onChange}
                        aria-invalid={Boolean(errors.discount_value)}
                      />
                    )}
                  />
                  {errors.discount_value && (
                    <p className="text-sm text-destructive">{errors.discount_value.message}</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t pt-3 text-sm">
              <span className="font-medium">Valor final</span>
              <span className="text-base font-semibold" data-testid="package-final">
                {formatCurrencyBRL(final)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Observações internas</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea id="notes" rows={4} {...register("notes")} />
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

      <ServiceQuickCreateDialog
        open={serviceDialogOpen}
        onOpenChange={setServiceDialogOpen}
        onCreated={addService}
      />
    </form>
  );
}
