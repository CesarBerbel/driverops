import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Lock, Save, Search } from "lucide-react";
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

import { getSmartSearchSettings, updateSmartSearchSettings } from "../api";
import type { SmartSearchSettings } from "../types";

const TOGGLES: { key: keyof SmartSearchSettings; label: string; help?: string }[] = [
  {
    key: "use_ai",
    label: "Usar IA para interpretar a pergunta",
    help: "Quando desligada (ou indisponível), a busca continua funcionando por heurística.",
  },
  {
    key: "include_internal_notes",
    label: "Buscar em observações internas",
    help: "Trechos internos só aparecem para quem tem permissão de editar a OS.",
  },
  {
    key: "include_financial",
    label: "Permitir resultados financeiros",
    help: "Ainda exige a permissão financeira do usuário.",
  },
  { key: "store_history", label: "Guardar buscas recentes por usuário" },
  { key: "log_queries", label: "Registrar logs de uso (auditoria)" },
];

const NUMBERS: { key: keyof SmartSearchSettings; label: string; unit: string }[] = [
  { key: "result_limit", label: "Limite de resultados por busca", unit: "itens" },
  { key: "retention_days", label: "Retenção de histórico/logs", unit: "dias" },
];

export function SmartSearchSettingsPage() {
  const can = usePermissionCheck();
  const canEdit = can("settings.edit");
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["smart-search-settings"],
    queryFn: getSmartSearchSettings,
  });
  const [form, setForm] = useState<SmartSearchSettings | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => updateSmartSearchSettings(form ?? {}),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["smart-search-settings"] });
      setForm(updated);
      toast.success("Configurações salvas.");
    },
    onError: (e) => toast.error(extractErrorMessage(e, "Não foi possível salvar.")),
  });

  function set<K extends keyof SmartSearchSettings>(key: K, value: SmartSearchSettings[K]) {
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
          <Search className="size-5 text-primary" /> Busca Inteligente
        </h1>
        <p className="text-muted-foreground">
          Controle o uso de IA, o que pode ser pesquisado e a retenção de histórico e logs.
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
                      onCheckedChange={(v) => set(t.key, v as SmartSearchSettings[typeof t.key])}
                      aria-label={t.label}
                    />
                  </div>
                ))}
              </fieldset>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Limites</CardTitle>
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
                        set(n.key, Number(e.target.value) as SmartSearchSettings[typeof n.key])
                      }
                    />
                    <span className="w-12 text-sm text-muted-foreground">{n.unit}</span>
                  </div>
                ))}
              </fieldset>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Busca semântica (embeddings)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <fieldset disabled={!canEdit} className="space-y-3">
                <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2">
                  <div>
                    <Label>Ativar busca semântica</Label>
                    <p className="text-xs text-muted-foreground">
                      Encontra OS por significado (ex.: “luz do freio acesa” acha “lâmpada de stop
                      acesa”). Requer um provedor de embeddings e rodar o comando de indexação.
                    </p>
                  </div>
                  <Switch
                    checked={Boolean(form.semantic_enabled)}
                    onCheckedChange={(v) => set("semantic_enabled", v)}
                    aria-label="Ativar busca semântica"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="emb-model">Modelo de embeddings</Label>
                  <Input
                    id="emb-model"
                    value={form.embedding_model}
                    onChange={(e) => set("embedding_model", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="emb-url">Endpoint (compatível com OpenAI)</Label>
                  <Input
                    id="emb-url"
                    value={form.embedding_base_url}
                    onChange={(e) => set("embedding_base_url", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="emb-key">Variável de ambiente com a chave de API</Label>
                  <Input
                    id="emb-key"
                    value={form.embedding_api_key_env}
                    onChange={(e) => set("embedding_api_key_env", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    A chave nunca é salva no banco — apenas o nome da variável de ambiente.
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <Label className="flex-1">Dimensão do vetor</Label>
                  <Input
                    type="number"
                    className="w-24"
                    value={String(form.embedding_dimensions)}
                    onChange={(e) => set("embedding_dimensions", Number(e.target.value))}
                  />
                </div>
                <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <Label className="flex-1">Similaridade mínima (0–1)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="w-24"
                    value={String(form.similarity_threshold)}
                    onChange={(e) => set("similarity_threshold", Number(e.target.value))}
                  />
                </div>
              </fieldset>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
