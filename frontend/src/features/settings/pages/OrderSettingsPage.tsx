import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Loader2, Lock } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/useAuth";
import { extractErrorMessage } from "@/lib/api-client";
import { onlyDigits } from "@/lib/masks";

import { getOrderSettings, updateOrderSettings } from "../api";
import { orderSettingsSchema, type OrderSettingsFormValues } from "../schemas";
import type { OrderSettings } from "../types";

const TERM_FIELDS: {
  name: keyof OrderSettingsFormValues;
  label: string;
  description: string;
}[] = [
  {
    name: "warranty_terms",
    label: "Termo de garantia",
    description: "Usado no PDF e na página de aprovação do orçamento.",
  },
  {
    name: "quote_terms",
    label: "Termo de orçamento",
    description: "Usado no PDF e na página de aprovação do orçamento.",
  },
  {
    name: "service_authorization_terms",
    label: "Termo de autorização de serviço",
    description: "Usado no orçamento, quando o cliente autoriza a execução dos serviços.",
  },
  {
    name: "customer_acknowledgment_terms",
    label: "Termo de ciência do cliente",
    description: "Usado em documentos de aceite, retirada ou entrega do veículo.",
  },
  {
    name: "default_os_notes",
    label: "Observações padrão da OS",
    description: "Sugestão de observações padrão ao abrir uma nova OS.",
  },
  {
    name: "pdf_footer_text",
    label: "Texto padrão do rodapé dos PDFs",
    description: "Reutilizado no rodapé dos documentos gerados pelo sistema.",
  },
  {
    name: "print_instructions",
    label: "Instruções para documentos impressos",
    description: "Mensagens padrão exibidas nos documentos impressos.",
  },
  {
    name: "general_conditions",
    label: "Condições gerais de atendimento",
    description: "Condições gerais reutilizadas nos documentos, se aplicável.",
  },
];

function toFormValues(settings: OrderSettings): OrderSettingsFormValues {
  return {
    default_delivery_days: String(settings.default_delivery_days),
    warranty_terms: settings.warranty_terms,
    quote_terms: settings.quote_terms,
    service_authorization_terms: settings.service_authorization_terms,
    customer_acknowledgment_terms: settings.customer_acknowledgment_terms,
    default_os_notes: settings.default_os_notes,
    pdf_footer_text: settings.pdf_footer_text,
    print_instructions: settings.print_instructions,
    general_conditions: settings.general_conditions,
    notify_customer_by_email: settings.notify_customer_by_email,
  };
}

export function OrderSettingsPage() {
  const { user } = useAuth();
  const canEdit = Boolean(user?.is_superuser);
  const queryClient = useQueryClient();

  const { data: settings, isLoading, isError, refetch } = useQuery({
    queryKey: ["order-settings"],
    queryFn: getOrderSettings,
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
        <h1 className="text-2xl font-semibold tracking-tight">Configurações da OS</h1>
        <p className="text-muted-foreground">
          Regras padrão e textos usados na criação e edição das Ordens de Serviço e na geração de
          PDFs.
        </p>
      </div>

      {!canEdit && (
        <div className="flex items-start gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <span>Apenas superusuários podem editar as configurações da OS.</span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : isError || !settings ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertCircle className="size-8 text-destructive" />
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar as configurações da OS. Tente novamente.
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <OrderSettingsForm
          defaultValues={toFormValues(settings)}
          canEdit={canEdit}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["order-settings"] })}
        />
      )}
    </div>
  );
}

function OrderSettingsForm({
  defaultValues,
  canEdit,
  onSaved,
}: {
  defaultValues: OrderSettingsFormValues;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OrderSettingsFormValues>({
    resolver: zodResolver(orderSettingsSchema),
    defaultValues,
  });

  const mutation = useMutation({
    mutationFn: updateOrderSettings,
    onSuccess: () => {
      toast.success("Configurações da OS salvas.");
      onSaved();
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, "Não foi possível salvar as configurações da OS."));
    },
  });

  function onSubmit(values: OrderSettingsFormValues) {
    mutation.mutate({
      ...values,
      default_delivery_days: Number(values.default_delivery_days),
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <fieldset disabled={!canEdit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prazo padrão de entrega</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="default_delivery_days">Prazo padrão de entrega</Label>
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="default_delivery_days"
                render={({ field }) => (
                  <Input
                    id="default_delivery_days"
                    inputMode="numeric"
                    className="w-24"
                    value={field.value}
                    onChange={(event) => field.onChange(onlyDigits(event.target.value))}
                    aria-invalid={Boolean(errors.default_delivery_days)}
                  />
                )}
              />
              <span className="text-sm text-muted-foreground">dias</span>
            </div>
            {errors.default_delivery_days ? (
              <p className="text-sm text-destructive">
                {errors.default_delivery_days.message}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Aplicado automaticamente à previsão de entrega de novas OS (data de abertura +
                prazo). Alterar aqui não afeta OS já criadas. Use 0 para entrega no mesmo dia.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notificações ao cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="notify_customer_by_email">
                  Notificar o cliente por e-mail
                </Label>
                <p className="text-xs text-muted-foreground">
                  Envia um e-mail automático ao cliente quando a OS fica{" "}
                  <strong>Pronta para entrega</strong> ou é <strong>Finalizada</strong> (só
                  quando o cliente tem e-mail cadastrado). O envio manual pela OS funciona
                  independentemente desta opção.
                </p>
              </div>
              <Controller
                control={control}
                name="notify_customer_by_email"
                render={({ field }) => (
                  <Switch
                    id="notify_customer_by_email"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={!canEdit}
                    aria-label="Notificar o cliente por e-mail"
                  />
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Termos e textos padrão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {TERM_FIELDS.map((term) => (
              <div key={term.name} className="space-y-2">
                <Label htmlFor={term.name}>{term.label}</Label>
                <Textarea id={term.name} rows={4} {...register(term.name)} />
                <p className="text-xs text-muted-foreground">{term.description}</p>
              </div>
            ))}
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
