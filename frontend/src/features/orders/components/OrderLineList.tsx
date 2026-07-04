import { Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import {
  Controller,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";

import { CurrencyInput } from "@/components/shared/CurrencyInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrencyBRL } from "@/lib/masks";

import type { OrderFormValues, OrderLineValues } from "../schemas";
import { lineSubtotal } from "../lib/orderMapping";

type LinePrefix = "service_items" | "package_items" | "part_items";

function sanitizeQuantity(value: string): string {
  const cleaned = value.replace(/[^\d,]/g, "");
  const firstComma = cleaned.indexOf(",");
  if (firstComma === -1) return cleaned;
  return cleaned.slice(0, firstComma + 1) + cleaned.slice(firstComma + 1).replace(/,/g, "");
}

interface OrderLineListProps {
  title: string;
  helper?: string;
  namePrefix: LinePrefix;
  picker: ReactNode;
  inlineCreate?: ReactNode;
  onAddCustom: () => void;
  customLabel: string;
  emptyLabel: string;
  control: Control<OrderFormValues>;
  fields: (OrderLineValues & { id: string })[];
  watchedItems?: OrderLineValues[];
  remove: (index: number) => void;
  register: UseFormRegister<OrderFormValues>;
  errors?: FieldErrors<OrderFormValues>[LinePrefix];
}

export function OrderLineList({
  title,
  helper,
  namePrefix,
  picker,
  inlineCreate,
  onAddCustom,
  customLabel,
  emptyLabel,
  control,
  fields,
  watchedItems,
  remove,
  register,
  errors,
}: OrderLineListProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>{title}</Label>
          <div className="flex items-center gap-3">
            {inlineCreate}
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={onAddCustom}
            >
              <Plus className="size-3" />
              {customLabel}
            </Button>
          </div>
        </div>
        {picker}
        {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2">
          {fields.map((field, index) => {
            const isCustom = field.ref_id === null;
            const watched = watchedItems?.[index];
            const subtotal = watched ? lineSubtotal(watched) : 0;
            const fieldErrors = Array.isArray(errors) ? errors[index] : undefined;
            return (
              <li key={field.id} className="rounded-md border p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="flex-1 space-y-1">
                    {isCustom ? (
                      <Input
                        aria-label="Descrição do item"
                        placeholder="Descrição do item avulso"
                        aria-invalid={Boolean(fieldErrors?.name)}
                        {...register(`${namePrefix}.${index}.name`)}
                      />
                    ) : (
                      <p className="text-sm font-medium">{field.name}</p>
                    )}
                    <div className="flex items-center gap-2">
                      {isCustom && (
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                          Avulso
                        </span>
                      )}
                      {fieldErrors?.name && (
                        <p className="text-xs text-destructive">{fieldErrors.name.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-end gap-2">
                    <div className="w-20 space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Qtd.</Label>
                      <Controller
                        control={control}
                        name={`${namePrefix}.${index}.quantity`}
                        render={({ field: qtyField }) => (
                          <Input
                            inputMode="decimal"
                            aria-label="Quantidade"
                            value={qtyField.value}
                            onChange={(event) =>
                              qtyField.onChange(sanitizeQuantity(event.target.value))
                            }
                            aria-invalid={Boolean(fieldErrors?.quantity)}
                          />
                        )}
                      />
                    </div>
                    <div className="w-32 space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Valor unit.</Label>
                      <Controller
                        control={control}
                        name={`${namePrefix}.${index}.unit_price`}
                        render={({ field: priceField }) => (
                          <CurrencyInput
                            value={priceField.value}
                            onChange={priceField.onChange}
                            aria-invalid={Boolean(fieldErrors?.unit_price)}
                          />
                        )}
                      />
                    </div>
                    <div className="w-24 space-y-1 text-right">
                      <Label className="text-[10px] text-muted-foreground">Subtotal</Label>
                      <p className="py-2 text-sm font-medium">{formatCurrencyBRL(subtotal)}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label="Remover item"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
