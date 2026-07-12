import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Car, Loader2, Lock, Save } from "lucide-react";
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

import { getPortalSettings, updatePortalSettings } from "../api";
import type { PortalSettings } from "../types";

const TOGGLES: { key: keyof PortalSettings; label: string; help?: string }[] = [
  {
    key: "enabled",
    label: "Portal do cliente ativo",
    help: "Quando desligado, a solicitação de acesso responde de forma neutra sem enviar link.",
  },
  {
    key: "require_email",
    label: "Exigir e-mail na solicitação",
    help: "O cliente precisa informar o e-mail e ele deve bater com o cadastrado.",
  },
  {
    key: "single_use_token",
    label: "Link de uso único",
    help: "O link expira assim que é aberto pela primeira vez.",
  },
  { key: "show_history", label: "Mostrar histórico de serviços do veículo" },
  { key: "allow_messages", label: "Permitir mensagens do cliente para a oficina" },
  { key: "allow_pdf_download", label: "Permitir baixar o PDF da OS" },
  { key: "notify_on_access", label: "Avisar quando o cliente acessar o portal" },
  { key: "notify_on_message", label: "Avisar quando o cliente enviar mensagem" },
];

const NUMBERS: { key: keyof PortalSettings; label: string; unit: string }[] = [
  { key: "link_validity_hours", label: "Validade do link de acesso", unit: "horas" },
  { key: "resend_cooldown_seconds", label: "Intervalo mínimo entre reenvios", unit: "segundos" },
];

export function CustomerPortalSettingsPage() {
  const can = usePermissionCheck();
  const canEdit = can("settings.edit");
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["portal-settings"],
    queryFn: getPortalSettings,
  });
  const [form, setForm] = useState<PortalSettings | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => updatePortalSettings(form ?? {}),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["portal-settings"] });
      setForm(updated);
      toast.success("Configurações salvas.");
    },
    onError: (e) => toast.error(extractErrorMessage(e, "Não foi possível salvar.")),
  });

  function set<K extends keyof PortalSettings>(key: K, value: PortalSettings[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        to="/settings"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Configurações
      </Link>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Car className="size-5 text-primary" /> Portal do Cliente
        </h1>
        <p className="text-muted-foreground">
          Controle o acesso do cliente ao acompanhamento do veículo pelo link enviado por e-mail.
        </p>
      </div>

      {!canEdit && (
        <div className="flex items-start gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" />
          Você pode visualizar; editar exige a permissão "Alterar configurações".
        </div>
      )}

      {isLoading || !form ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Comportamento</CardTitle>
              {canEdit && (
                <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
                  {mutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Salvar
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <fieldset disabled={!canEdit} className="space-y-3">
                {TOGGLES.map((t) => (
                  <div
                    key={t.key}
                    className="flex items-center justify-between gap-4 rounded-md border px-3 py-2"
                  >
                    <div>
                      <Label>{t.label}</Label>
                      {t.help && <p className="text-xs text-muted-foreground">{t.help}</p>}
                    </div>
                    <Switch
                      checked={Boolean(form[t.key])}
                      onCheckedChange={(v) => set(t.key, v as PortalSettings[typeof t.key])}
                      aria-label={t.label}
                    />
                  </div>
                ))}
              </fieldset>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Segurança do link</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <fieldset disabled={!canEdit} className="space-y-2">
                {NUMBERS.map((n) => (
                  <div key={n.key} className="flex items-center gap-2 rounded-md border px-3 py-2">
                    <Label className="flex-1">{n.label}</Label>
                    <Input
                      type="number"
                      className="w-24"
                      value={String(form[n.key] ?? 0)}
                      onChange={(e) =>
                        set(n.key, Number(e.target.value) as PortalSettings[typeof n.key])
                      }
                    />
                    <span className="w-16 text-sm text-muted-foreground">{n.unit}</span>
                  </div>
                ))}
              </fieldset>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
