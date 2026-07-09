import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bell, Loader2, Lock, Save, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { usePermissionCheck } from "@/features/auth/usePermission";
import { extractErrorMessage } from "@/lib/api-client";

import {
  getNotificationPreferences,
  getNotificationRules,
  sendManualNotification,
  updateNotificationPreferences,
  updateNotificationRules,
} from "../api";
import { MODULE_OPTIONS, PRIORITY_OPTIONS } from "../constants";
import type { NotificationPreference, NotificationRule } from "../types";

const ROLE_OPTIONS = [
  { value: "administrador", label: "Administrador" },
  { value: "atendente", label: "Atendente" },
  { value: "tecnico", label: "Técnico" },
  { value: "estoque", label: "Estoque" },
  { value: "financeiro", label: "Financeiro" },
];

function RulesSection({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["notification-rules"],
    queryFn: getNotificationRules,
  });
  const [rules, setRules] = useState<NotificationRule[]>([]);

  useEffect(() => {
    if (data) setRules(data);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      updateNotificationRules(
        rules.map((r) => ({
          notif_type: r.notif_type,
          is_enabled: r.is_enabled,
          priority: r.priority,
          lead_time_hours: r.lead_time_hours,
          stall_days: r.stall_days,
          show_in_bell: r.show_in_bell,
          send_email: r.send_email,
          show_in_dashboard: r.show_in_dashboard,
          group_similar: r.group_similar,
          auto_expire_days: r.auto_expire_days,
        })),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-rules"] });
      toast.success("Configurações salvas.");
    },
    onError: (err) => toast.error(extractErrorMessage(err, "Não foi possível salvar.")),
  });

  function patch(type: string, change: Partial<NotificationRule>) {
    setRules((prev) => prev.map((r) => (r.notif_type === type ? { ...r, ...change } : r)));
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (isError)
    return (
      <Button variant="outline" onClick={() => refetch()}>
        Tentar novamente
      </Button>
    );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Avisos automáticos</CardTitle>
        {canEdit && (
          <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Salvar
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <fieldset disabled={!canEdit} className="space-y-3">
          {rules.map((rule) => (
            <div key={rule.notif_type} className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{rule.notif_type_display}</p>
                  <p className="text-xs text-muted-foreground">{rule.module}</p>
                </div>
                <Switch
                  checked={rule.is_enabled}
                  onCheckedChange={(v) => patch(rule.notif_type, { is_enabled: v })}
                  aria-label={`Ativar ${rule.notif_type_display}`}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <label className="flex items-center gap-1">
                  Prioridade
                  <Select
                    value={rule.priority}
                    onValueChange={(v) => patch(rule.notif_type, { priority: v as NotificationRule["priority"] })}
                  >
                    <SelectTrigger className="h-8 w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="flex items-center gap-1">
                  Antecedência (h)
                  <Input
                    type="number"
                    className="h-8 w-20"
                    value={rule.lead_time_hours}
                    onChange={(e) => patch(rule.notif_type, { lead_time_hours: Number(e.target.value) })}
                  />
                </label>
                <label className="flex items-center gap-1">
                  Limite (dias)
                  <Input
                    type="number"
                    className="h-8 w-20"
                    value={rule.stall_days}
                    onChange={(e) => patch(rule.notif_type, { stall_days: Number(e.target.value) })}
                  />
                </label>
                <label className="flex items-center gap-1">
                  <Switch
                    checked={rule.send_email}
                    onCheckedChange={(v) => patch(rule.notif_type, { send_email: v })}
                    aria-label="E-mail interno"
                  />
                  E-mail
                </label>
                <label className="flex items-center gap-1">
                  <Switch
                    checked={rule.group_similar}
                    onCheckedChange={(v) => patch(rule.notif_type, { group_similar: v })}
                    aria-label="Agrupar semelhantes"
                  />
                  Agrupar
                </label>
              </div>
            </div>
          ))}
        </fieldset>
      </CardContent>
    </Card>
  );
}

const PREF_TOGGLES: { key: keyof NotificationPreference; label: string }[] = [
  { key: "only_assigned", label: "Só o que está atribuído a mim" },
  { key: "only_high_priority", label: "Só avisos de alta prioridade" },
  { key: "mute_informational", label: "Silenciar avisos informativos" },
  { key: "sound_enabled", label: "Som de notificação" },
];

function PreferencesSection() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: getNotificationPreferences,
  });
  const [form, setForm] = useState<NotificationPreference | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: (changes: Partial<NotificationPreference>) => updateNotificationPreferences(changes),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
      setForm(updated);
    },
    onError: (err) => toast.error(extractErrorMessage(err, "Não foi possível salvar.")),
  });

  if (isLoading || !form) return <Skeleton className="h-40 w-full" />;

  function toggleModule(mod: string) {
    if (!form) return;
    const muted = form.muted_modules.includes(mod)
      ? form.muted_modules.filter((m) => m !== mod)
      : [...form.muted_modules, mod];
    setForm({ ...form, muted_modules: muted });
    save.mutate({ muted_modules: muted });
  }

  function setToggle(key: keyof NotificationPreference, value: boolean) {
    if (!form) return;
    setForm({ ...form, [key]: value });
    save.mutate({ [key]: value });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Minhas preferências</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {PREF_TOGGLES.map((t) => (
          <div key={t.key} className="flex items-center justify-between rounded-md border px-3 py-2">
            <Label>{t.label}</Label>
            <Switch
              checked={Boolean(form[t.key])}
              onCheckedChange={(v) => setToggle(t.key, v)}
              aria-label={t.label}
            />
          </div>
        ))}
        <div className="rounded-md border p-3">
          <p className="mb-2 text-sm font-medium">Silenciar módulos</p>
          <div className="flex flex-wrap gap-2">
            {MODULE_OPTIONS.map((m) => {
              const muted = form.muted_modules.includes(m.value);
              return (
                <Button
                  key={m.value}
                  type="button"
                  size="sm"
                  variant={muted ? "default" : "outline"}
                  onClick={() => toggleModule(m.value)}
                >
                  {m.label}
                  {muted ? " (silenciado)" : ""}
                </Button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ManualSection() {
  const [roleKey, setRoleKey] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("important");

  const send = useMutation({
    mutationFn: () => sendManualNotification({ role_key: roleKey, title, message, priority }),
    onSuccess: (res) => {
      toast.success(`Aviso enviado para ${res.created} usuário(s).`);
      setTitle("");
      setMessage("");
    },
    onError: (err) => toast.error(extractErrorMessage(err, "Não foi possível enviar.")),
  });

  const canSend = roleKey && title.trim() && message.trim();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Enviar aviso manual</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Select value={roleKey} onValueChange={setRoleKey}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Perfil destinatário" />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea
          placeholder="Mensagem"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <Button disabled={!canSend || send.isPending} onClick={() => send.mutate()}>
          {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Enviar
        </Button>
      </CardContent>
    </Card>
  );
}

export function NotificationSettingsPage() {
  const can = usePermissionCheck();
  const canConfigure = can("alerts.configure");
  const canSendManual = can("alerts.send_manual");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        to="/settings"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Configurações
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Bell className="size-5 text-primary" /> Central de Notificações
        </h1>
        <p className="text-muted-foreground">
          Escolha quais avisos internos a oficina recebe e ajuste as suas preferências.
        </p>
      </div>

      {!canConfigure && (
        <div className="flex items-start gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" />
          Você pode ver os avisos automáticos; editá-los exige a permissão "Configurar avisos
          internos". Suas preferências pessoais abaixo continuam editáveis.
        </div>
      )}

      <RulesSection canEdit={canConfigure} />
      <PreferencesSection />
      {canSendManual && <ManualSection />}
    </div>
  );
}
