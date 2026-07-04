import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageCircle } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { MaskedInput } from "@/components/shared/MaskedInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { extractErrorMessage } from "@/lib/api-client";
import { lookupCep } from "@/lib/cepService";
import { formatCEP, formatDocument, formatPhone, formatUF } from "@/lib/masks";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

import { createSupplier, updateSupplier } from "../api";
import { SUPPLIER_TYPE_OPTIONS } from "../constants";
import { supplierSchema, type SupplierFormValues } from "../schemas";
import type { Supplier, SupplierType } from "../types";

const EMPTY_VALUES: SupplierFormValues = {
  name: "",
  trade_name: "",
  supplier_type: "company",
  document: "",
  state_registration: "",
  email: "",
  phone: "",
  whatsapp: "",
  contact_name: "",
  zip_code: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  country: "Brasil",
  notes: "",
};

function toFormValues(supplier: Supplier): SupplierFormValues {
  return {
    name: supplier.name,
    trade_name: supplier.trade_name,
    supplier_type: supplier.supplier_type,
    document: supplier.document,
    state_registration: supplier.state_registration,
    email: supplier.email,
    phone: supplier.phone,
    whatsapp: supplier.whatsapp,
    contact_name: supplier.contact_name,
    zip_code: supplier.zip_code,
    street: supplier.street,
    number: supplier.number,
    complement: supplier.complement,
    neighborhood: supplier.neighborhood,
    city: supplier.city,
    state: supplier.state,
    country: supplier.country,
    notes: supplier.notes,
  };
}

interface SupplierFormProps {
  supplier: Supplier | null;
  onSuccess: (supplier: Supplier) => void;
  onCancel?: () => void;
}

export function SupplierForm({ supplier, onSuccess, onCancel }: SupplierFormProps) {
  const queryClient = useQueryClient();
  const isEditMode = supplier !== null;

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: supplier ? toFormValues(supplier) : EMPTY_VALUES,
  });

  const supplierType = watch("supplier_type");

  const mutation = useMutation({
    mutationFn: (values: SupplierFormValues) =>
      isEditMode ? updateSupplier(supplier.id, values) : createSupplier(values),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success(isEditMode ? "Fornecedor atualizado." : "Fornecedor criado.");
      onSuccess(saved);
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, "Não foi possível salvar o fornecedor."));
    },
  });

  function handleSupplierTypeChange(newType: SupplierType, onChange: (value: SupplierType) => void) {
    const currentDocument = getValues("document");
    if (currentDocument) {
      const expectedLength = newType === "company" ? 14 : 11;
      if (currentDocument.length !== expectedLength) {
        setValue("document", "");
        toast(
          "Documento limpo porque não é compatível com o novo tipo de fornecedor. Revise o valor.",
        );
      }
    }
    onChange(newType);
  }

  async function handleCepChange(digits: string, onChange: (value: string) => void) {
    onChange(digits);
    if (digits.length !== 8) return;

    const result = await lookupCep(digits);
    if (result.status === "found") {
      setValue("street", result.address.street, { shouldDirty: true });
      setValue("neighborhood", result.address.neighborhood, { shouldDirty: true });
      setValue("city", result.address.city, { shouldDirty: true });
      setValue("state", result.address.state, { shouldDirty: true });
    } else if (result.status === "not_found") {
      toast("CEP não encontrado. Preencha o endereço manualmente.");
    } else {
      toast("Não foi possível consultar o CEP agora. Preencha o endereço manualmente.");
    }
  }

  return (
    <form
      onSubmit={(event) => {
        // This form can be nested (via SupplierQuickCreateDialog's Radix
        // Portal) inside another <form> in the React tree -- e.g. the part
        // cadastro's own form. React re-dispatches bubbling events along the
        // *component* tree for portaled content, so without stopPropagation
        // here, submitting this form would also fire the ancestor form's
        // onSubmit and silently create/save it with whatever state it had
        // at that moment (e.g. a part saved with supplier left unset).
        event.stopPropagation();
        handleSubmit((values) => mutation.mutate(values))(event);
      }}
      className="flex flex-1 flex-col overflow-hidden"
      noValidate
    >
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados básicos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="supplier-name">Nome/Razão social</Label>
              <Input id="supplier-name" aria-invalid={Boolean(errors.name)} {...register("name")} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier-trade_name">Nome fantasia</Label>
              <Input id="supplier-trade_name" {...register("trade_name")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier-type">Tipo de fornecedor</Label>
              <Controller
                control={control}
                name="supplier_type"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) =>
                      handleSupplierTypeChange(value as SupplierType, field.onChange)
                    }
                  >
                    <SelectTrigger id="supplier-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPLIER_TYPE_OPTIONS.map((option) => (
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
              <Label htmlFor="supplier-document">
                Documento ({supplierType === "company" ? "CNPJ" : "CPF"})
              </Label>
              <Controller
                control={control}
                name="document"
                render={({ field }) => (
                  <MaskedInput
                    id="supplier-document"
                    value={field.value}
                    onChange={field.onChange}
                    format={(digits) => formatDocument(digits, supplierType)}
                    maxDigits={supplierType === "company" ? 14 : 11}
                    aria-invalid={Boolean(errors.document)}
                  />
                )}
              />
              {errors.document && (
                <p className="text-sm text-destructive">{errors.document.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier-state_registration">Inscrição estadual</Label>
              <Input id="supplier-state_registration" {...register("state_registration")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier-contact_name">Nome do contato</Label>
              <Input id="supplier-contact_name" {...register("contact_name")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier-email">E-mail</Label>
              <Input
                id="supplier-email"
                type="email"
                aria-invalid={Boolean(errors.email)}
                {...register("email")}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier-phone">Telefone</Label>
              <Controller
                control={control}
                name="phone"
                render={({ field }) => (
                  <MaskedInput
                    id="supplier-phone"
                    value={field.value}
                    onChange={field.onChange}
                    format={formatPhone}
                    maxDigits={11}
                    aria-invalid={Boolean(errors.phone)}
                  />
                )}
              />
              {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier-whatsapp">WhatsApp</Label>
              <Controller
                control={control}
                name="whatsapp"
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    <MaskedInput
                      id="supplier-whatsapp"
                      value={field.value}
                      onChange={field.onChange}
                      format={formatPhone}
                      maxDigits={11}
                      aria-invalid={Boolean(errors.whatsapp)}
                    />
                    {field.value.length >= 10 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Abrir conversa no WhatsApp"
                        asChild
                      >
                        <a
                          href={buildWhatsAppUrl(field.value)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MessageCircle className="size-4 text-success" />
                        </a>
                      </Button>
                    )}
                  </div>
                )}
              />
              {errors.whatsapp && (
                <p className="text-sm text-destructive">{errors.whatsapp.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Endereço</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="supplier-zip_code">CEP</Label>
              <Controller
                control={control}
                name="zip_code"
                render={({ field }) => (
                  <MaskedInput
                    id="supplier-zip_code"
                    value={field.value}
                    onChange={(digits) => handleCepChange(digits, field.onChange)}
                    format={formatCEP}
                    maxDigits={8}
                    aria-invalid={Boolean(errors.zip_code)}
                  />
                )}
              />
              {errors.zip_code && (
                <p className="text-sm text-destructive">{errors.zip_code.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier-street">Rua/Logradouro</Label>
              <Input id="supplier-street" {...register("street")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier-number">Número</Label>
              <Input id="supplier-number" {...register("number")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier-complement">Complemento</Label>
              <Input id="supplier-complement" {...register("complement")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier-neighborhood">Bairro</Label>
              <Input id="supplier-neighborhood" {...register("neighborhood")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier-city">Cidade</Label>
              <Input id="supplier-city" {...register("city")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier-state">Estado (UF)</Label>
              <Controller
                control={control}
                name="state"
                render={({ field }) => (
                  <Input
                    id="supplier-state"
                    maxLength={2}
                    value={field.value}
                    onChange={(event) => field.onChange(formatUF(event.target.value))}
                    aria-invalid={Boolean(errors.state)}
                  />
                )}
              />
              {errors.state && <p className="text-sm text-destructive">{errors.state.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier-country">País</Label>
              <Input id="supplier-country" {...register("country")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea id="supplier-notes" rows={4} {...register("notes")} />
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
    </form>
  );
}
