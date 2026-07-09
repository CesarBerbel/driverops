import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Lock, Save, Sparkles } from "lucide-react";
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

import { getCrmSettings, updateCrmSettings } from "../api";
import type { CrmSettings } from "../types";

const TOGGLES: { key: keyof CrmSettings; label: string; help?: string }[] = [
  { key: "is_active", label: "CRM inteligente ativo" },
  { key: "allow_ai_messages", label: "Permitir gerar mensagens com IA" },
  { key: "seasonal_campaigns_enabled", label: "Campanhas sazonais (feriados)" },
  { key: "use_os_data", label: "Usar dados da OS nas sugestões" },
  { key: "use_financial_data", label: "Usar dados financeiros nas sugestões" },
  {
    key: "auto_send_messages",
    label: "Enviar mensagens automaticamente",
    help: "Desligado por padrão — nada é enviado sem confirmação.",
  },
  { key: "auto_create_tasks", label: "Criar tarefas automaticamente" },
];

const TIME_RULES: { key: keyof CrmSettings; label: string; unit: string }[] = [
  { key: "lead_sla_hours", label: "Contato de pedido do site após", unit: "horas" },
  { key: "quote_followup_days", label: "Follow-up de orçamento sem resposta após", unit: "dias" },
  { key: "quote_expiring_days", label: "Aviso de orçamento a vencer com antecedência de", unit: "dias" },
  { key: "rejected_recovery_days", label: "Recuperação de orçamento recusado após", unit: "dias" },
  { key: "os_ready_days", label: "Lembrete de OS pronta após", unit: "dias" },
  { key: "os_awaiting_days", label: "OS aguardando aprovação após", unit: "dias" },
  { key: "os_stalled_days", label: "OS parada no status após", unit: "dias" },
  { key: "post_service_days", label: "Contato pós-serviço após", unit: "dias" },
  { key: "preventive_months", label: "Revisão preventiva após", unit: "meses" },
  { key: "inactive_months", label: "Reativação de cliente inativo após", unit: "meses" },
  { key: "holiday_lead_days", label: "Campanha de feriado com antecedência de", unit: "dias" },
];

export function CrmSettingsPage() {
  const can = usePermissionCheck();
  const canEdit = can("crm.configure");
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["crm-settings"], queryFn: getCrmSettings });
  const [form, setForm] = useState<CrmSettings | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => updateCrmSettings(form ?? {}),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["crm-settings"] });
      setForm(updated);
      toast.success("Configurações salvas.");
    },
    onError: (e) => toast.error(extractErrorMessage(e, "Não foi possível salvar.")),
  });

  function set<K extends keyof CrmSettings>(key: K, value: CrmSettings[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link to="/settings" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Configurações
      </Link>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Sparkles className="size-5 text-primary" /> CRM Inteligente com IA
        </h1>
        <p className="text-muted-foreground">
          Ative os avisos, ajuste os prazos das regras e o comportamento da IA.
        </p>
      </div>

      {!canEdit && (
        <div className="flex items-start gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" />
          Você pode visualizar; editar exige a permissão "Configurar o CRM inteligente".
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
                      onCheckedChange={(v) => set(t.key, v as CrmSettings[typeof t.key])}
                      aria-label={t.label}
                    />
                  </div>
                ))}
              </fieldset>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Regras de tempo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <fieldset disabled={!canEdit} className="space-y-2">
                {TIME_RULES.map((r) => (
                  <div key={r.key} className="flex items-center gap-2 rounded-md border px-3 py-2">
                    <Label className="flex-1">{r.label}</Label>
                    <Input
                      type="number"
                      className="w-20"
                      value={String(form[r.key] ?? 0)}
                      onChange={(e) => set(r.key, Number(e.target.value) as CrmSettings[typeof r.key])}
                    />
                    <span className="w-12 text-sm text-muted-foreground">{r.unit}</span>
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
