import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Loader2, Lock } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { MaskedInput } from "@/components/shared/MaskedInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/useAuth";
import { extractErrorMessage } from "@/lib/api-client";
import { lookupCep } from "@/lib/cepService";
import { formatCEP, formatCNPJ, formatPhone, formatUF } from "@/lib/masks";

import { getWorkshopProfile, updateWorkshopProfile } from "../api";
import { workshopProfileSchema, type WorkshopProfileFormValues } from "../schemas";
import type { WorkshopProfile } from "../types";

function toFormValues(profile: WorkshopProfile): WorkshopProfileFormValues {
  return {
    trade_name: profile.trade_name,
    legal_name: profile.legal_name,
    cnpj: profile.cnpj,
    state_registration: profile.state_registration,
    responsible: profile.responsible,
    email: profile.email,
    phone: profile.phone,
    whatsapp: profile.whatsapp,
    website: profile.website,
    logo_url: profile.logo_url,
    zip_code: profile.zip_code,
    street: profile.street,
    number: profile.number,
    complement: profile.complement,
    neighborhood: profile.neighborhood,
    city: profile.city,
    state: profile.state,
    country: profile.country || "Brasil",
    notes: profile.notes,
  };
}

export function WorkshopProfilePage() {
  const { user } = useAuth();
  const canEdit = Boolean(user?.is_superuser);
  const queryClient = useQueryClient();

  const { data: profile, isLoading, isError, refetch } = useQuery({
    queryKey: ["workshop-profile"],
    queryFn: getWorkshopProfile,
  });

  return (
    <div className="space-y-6">
      <Link
        to="/settings"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Configurações
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dados da Oficina</h1>
        <p className="text-muted-foreground">
          Informações institucionais usadas nos cabeçalhos e rodapés dos documentos e PDFs da
          oficina.
        </p>
      </div>

      {!canEdit && (
        <div className="flex items-start gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <span>Apenas superusuários podem editar os dados da oficina.</span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : isError || !profile ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertCircle className="size-8 text-destructive" />
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar os dados da oficina. Tente novamente.
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <WorkshopProfileForm
          defaultValues={toFormValues(profile)}
          canEdit={canEdit}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["workshop-profile"] })}
        />
      )}
    </div>
  );
}

function WorkshopProfileForm({
  defaultValues,
  canEdit,
  onSaved,
}: {
  defaultValues: WorkshopProfileFormValues;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<WorkshopProfileFormValues>({
    resolver: zodResolver(workshopProfileSchema),
    defaultValues,
  });

  const mutation = useMutation({
    mutationFn: updateWorkshopProfile,
    onSuccess: () => {
      toast.success("Dados da oficina salvos.");
      onSaved();
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, "Não foi possível salvar os dados da oficina."));
    },
  });

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
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      className="space-y-6"
      noValidate
    >
      <fieldset disabled={!canEdit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identificação</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="trade_name">Nome fantasia</Label>
              <Input
                id="trade_name"
                aria-invalid={Boolean(errors.trade_name)}
                {...register("trade_name")}
              />
              {errors.trade_name && (
                <p className="text-sm text-destructive">{errors.trade_name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="legal_name">Razão social</Label>
              <Input id="legal_name" {...register("legal_name")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Controller
                control={control}
                name="cnpj"
                render={({ field }) => (
                  <MaskedInput
                    id="cnpj"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    format={formatCNPJ}
                    maxDigits={14}
                  />
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state_registration">Inscrição estadual</Label>
              <Input id="state_registration" {...register("state_registration")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="responsible">Responsável</Label>
              <Input id="responsible" {...register("responsible")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contato</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail principal</Label>
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
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    format={formatPhone}
                    maxDigits={11}
                  />
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Controller
                control={control}
                name="whatsapp"
                render={({ field }) => (
                  <MaskedInput
                    id="whatsapp"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    format={formatPhone}
                    maxDigits={11}
                  />
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Site</Label>
              <Input id="website" placeholder="https://" {...register("website")} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="logo_url">Logo (URL)</Label>
              <Input id="logo_url" placeholder="https://" {...register("logo_url")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Endereço</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="zip_code">CEP</Label>
              <Controller
                control={control}
                name="zip_code"
                render={({ field }) => (
                  <MaskedInput
                    id="zip_code"
                    value={field.value ?? ""}
                    onChange={(digits) => handleCepChange(digits, field.onChange)}
                    format={formatCEP}
                    maxDigits={8}
                  />
                )}
              />
            </div>
            <div className="space-y-2">
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
                    value={field.value ?? ""}
                    onChange={(event) => field.onChange(formatUF(event.target.value))}
                  />
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">País</Label>
              <Input id="country" {...register("country")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Observações institucionais</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea id="notes" rows={4} {...register("notes")} />
          </CardContent>
        </Card>
      </fieldset>

      {canEdit && (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" asChild>
            <Link to="/settings">Voltar</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            {(isSubmitting || mutation.isPending) && <Loader2 className="animate-spin" />}
            Salvar alterações
          </Button>
        </div>
      )}
    </form>
  );
}
