import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { extractErrorMessage } from "@/lib/api-client";
import { formatCEP, formatDocument, formatPhone, formatUF } from "@/lib/masks";

import { createCustomer, getCustomer, updateCustomer } from "../api";
import { CUSTOMER_TYPE_OPTIONS } from "../constants";
import { lookupCep } from "../cepService";
import { customerSchema, type CustomerFormValues } from "../schemas";
import type { Customer, CustomerType } from "../types";

const EMPTY_VALUES: CustomerFormValues = {
  name: "",
  customer_type: "individual",
  email: "",
  phone: "",
  document: "",
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

function toFormValues(customer: Customer): CustomerFormValues {
  return {
    name: customer.name,
    customer_type: customer.customer_type,
    email: customer.email,
    phone: customer.phone,
    document: customer.document,
    zip_code: customer.zip_code,
    street: customer.street,
    number: customer.number,
    complement: customer.complement,
    neighborhood: customer.neighborhood,
    city: customer.city,
    state: customer.state,
    country: customer.country,
    notes: customer.notes,
  };
}

export function CustomerFormPage() {
  const { id } = useParams();
  const customerId = id ? Number(id) : null;
  const isEditMode = customerId !== null;

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customers", customerId],
    queryFn: () => getCustomer(customerId as number),
    enabled: isEditMode,
  });

  if (isEditMode && isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <CustomerForm
      key={customerId ?? "new"}
      customerId={customerId}
      defaultValues={customer ? toFormValues(customer) : EMPTY_VALUES}
    />
  );
}

function CustomerForm({
  customerId,
  defaultValues,
}: {
  customerId: number | null;
  defaultValues: CustomerFormValues;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditMode = customerId !== null;

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues,
  });

  const customerType = watch("customer_type");

  const mutation = useMutation({
    mutationFn: (values: CustomerFormValues) =>
      isEditMode ? updateCustomer(customerId, values) : createCustomer(values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success(isEditMode ? "Cliente atualizado." : "Cliente criado.");
      navigate("/customers");
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, "Não foi possível salvar o cliente."));
    },
  });

  function handleCustomerTypeChange(newType: CustomerType, onChange: (value: CustomerType) => void) {
    const currentDocument = getValues("document");
    if (currentDocument) {
      const expectedLength = newType === "company" ? 14 : 11;
      if (currentDocument.length !== expectedLength) {
        setValue("document", "");
        toast(
          "Documento limpo porque não é compatível com o novo tipo de cliente. Revise o valor.",
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
    <div className="space-y-6">
      <Link
        to="/customers"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Clientes
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {isEditMode ? "Editar cliente" : "Novo cliente"}
        </h1>
        <p className="text-muted-foreground">
          Apenas o nome é obrigatório -- os demais dados podem ser completados depois.
        </p>
      </div>

      <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-6" noValidate>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados básicos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" aria-invalid={Boolean(errors.name)} {...register("name")} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer_type">Tipo de cliente</Label>
              <Controller
                control={control}
                name="customer_type"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) =>
                      handleCustomerTypeChange(value as CustomerType, field.onChange)
                    }
                  >
                    <SelectTrigger id="customer_type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CUSTOMER_TYPE_OPTIONS.map((option) => (
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
              <Label htmlFor="document">
                Documento ({customerType === "company" ? "CNPJ" : "CPF"})
              </Label>
              <Controller
                control={control}
                name="document"
                render={({ field }) => (
                  <MaskedInput
                    id="document"
                    value={field.value}
                    onChange={field.onChange}
                    format={(digits) => formatDocument(digits, customerType)}
                    maxDigits={customerType === "company" ? 14 : 11}
                    aria-invalid={Boolean(errors.document)}
                  />
                )}
              />
              {errors.document && (
                <p className="text-sm text-destructive">{errors.document.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                aria-invalid={Boolean(errors.email)}
                {...register("email")}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Controller
                control={control}
                name="phone"
                render={({ field }) => (
                  <MaskedInput
                    id="phone"
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Endereço</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="zip_code">CEP</Label>
              <Controller
                control={control}
                name="zip_code"
                render={({ field }) => (
                  <MaskedInput
                    id="zip_code"
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

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="street">Rua/Logradouro</Label>
              <Input id="street" {...register("street")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="number">Número</Label>
              <Input id="number" {...register("number")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="complement">Complemento</Label>
              <Input id="complement" {...register("complement")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="neighborhood">Bairro</Label>
              <Input id="neighborhood" {...register("neighborhood")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Input id="city" {...register("city")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">Estado (UF)</Label>
              <Controller
                control={control}
                name="state"
                render={({ field }) => (
                  <Input
                    id="state"
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
              <Label htmlFor="country">País</Label>
              <Input id="country" {...register("country")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea id="notes" rows={4} {...register("notes")} />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate("/customers")}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            {(isSubmitting || mutation.isPending) && <Loader2 className="animate-spin" />}
            Salvar
          </Button>
        </div>
      </form>
    </div>
  );
}
