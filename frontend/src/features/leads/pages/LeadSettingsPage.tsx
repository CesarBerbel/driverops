import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Inbox, Loader2, Lock, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { usePermissionCheck } from "@/features/auth/usePermission";
import { extractErrorMessage } from "@/lib/api-client";

import { getLeadSettings, updateLeadSettings } from "../api";
import type { LeadSettings } from "../types";

const TOGGLES: { key: keyof LeadSettings; label: string; help?: string }[] = [
  { key: "is_active", label: "Formulário público ativo", help: "Quando desligado, o formulário do site fica indisponível." },
  { key: "email_required", label: "E-mail obrigatório" },
  { key: "plate_required", label: "Placa obrigatória" },
  { key: "allow_without_vehicle", label: "Permitir pedido sem veículo" },
  { key: "require_consent", label: "Exigir consentimento para contato" },
  { key: "auto_reply_enabled", label: "Enviar confirmação automática ao cliente" },
  { key: "notify_email", label: "Notificar a oficina por e-mail a cada pedido" },
  { key: "allow_create_os", label: "Permitir criar OS a partir do pedido" },
  { key: "allow_create_appointment", label: "Permitir criar agendamento a partir do pedido" },
  { key: "require_review_on_divergence", label: "Exigir revisão manual em caso de divergência" },
  { key: "block_conversion_when_vehicle_other_customer", label: "Bloquear conversão quando o veículo pertence a outro cliente" },
];

export function LeadSettingsPage() {
  const can = usePermissionCheck();
  const canEdit = can("leads.config");
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["lead-settings"],
    queryFn: getLeadSettings,
  });
  const [form, setForm] = useState<LeadSettings | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => updateLeadSettings(form ?? {}),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["lead-settings"] });
      setForm(updated);
      toast.success("Configurações salvas.");
    },
    onError: (err) => toast.error(extractErrorMessage(err, "Não foi possível salvar.")),
  });

  function set<K extends keyof LeadSettings>(key: K, value: LeadSettings[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  return (
    <div className="space-y-6">
      <Link to="/settings" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Configurações
      </Link>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Inbox className="size-5 text-primary" /> Pedidos do Site
          </h1>
          <p className="text-muted-foreground">
            Controle o formulário público de contato e o comportamento dos pedidos recebidos.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/leads">Ver pedidos</Link>
        </Button>
      </div>

      {!canEdit && (
        <div className="flex items-start gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" />
          Você pode visualizar as configurações. Editar exige a permissão "Configurar formulário".
        </div>
      )}

      {isLoading || !form ? (
        <Skeleton className="h-64 w-full" />
      ) : isError ? (
        <Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
      ) : (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Formulário e notificações</CardTitle>
            {canEdit && (
              <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
                {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Salvar
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <fieldset disabled={!canEdit} className="space-y-3">
              {TOGGLES.map((t) => (
                <div key={t.key} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div>
                    <Label>{t.label}</Label>
                    {t.help && <p className="text-xs text-muted-foreground">{t.help}</p>}
                  </div>
                  <Switch
                    checked={Boolean(form[t.key])}
                    onCheckedChange={(v) => set(t.key, v as LeadSettings[typeof t.key])}
                    aria-label={t.label}
                  />
                </div>
              ))}
              <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                <Label htmlFor="sla" className="flex-1">Prazo de resposta (SLA, horas)</Label>
                <Input
                  id="sla"
                  type="number"
                  className="w-24"
                  value={form.sla_hours}
                  onChange={(e) => set("sla_hours", Number(e.target.value))}
                />
              </div>
            </fieldset>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
