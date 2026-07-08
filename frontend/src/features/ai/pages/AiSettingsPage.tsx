import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Info,
  Loader2,
  Lock,
  Save,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  getAIMetadata,
  getAISettings,
  listAIFieldInstructions,
  listAIUsageLogs,
  testAIPrompt,
  updateAISettings,
} from "../api";
import type { AIFieldInstruction, AIProvider } from "../types";
import { AiFieldInstructionEditor } from "../components/AiFieldInstructionEditor";

const PROVIDERS: { value: AIProvider; label: string }[] = [
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Gemini" },
  { value: "custom", label: "Outro (compatível OpenAI)" },
];

export function AiSettingsPage() {
  const can = usePermissionCheck();
  const canEdit = can("ai.edit");
  const canTest = can("ai.test");
  const canLogs = can("ai.logs");

  const settingsQuery = useQuery({ queryKey: ["ai-settings"], queryFn: getAISettings });
  const metadataQuery = useQuery({ queryKey: ["ai-metadata"], queryFn: getAIMetadata });
  const instructionsQuery = useQuery({
    queryKey: ["ai-field-instructions"],
    queryFn: listAIFieldInstructions,
  });

  const [selected, setSelected] = useState<AIFieldInstruction | null>(null);
  const [testOpen, setTestOpen] = useState(false);

  return (
    <div className="space-y-6">
      <Link
        to="/settings"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Configurações
      </Link>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Sparkles className="size-5 text-primary" />
            Assistente de IA para Textos da OS
          </h1>
          <p className="text-muted-foreground">
            Ajuda a redigir, revisar e padronizar os textos da OS sem inventar
            informações. Configure o provedor, o comportamento global e as instruções
            por campo.
          </p>
        </div>
        {canTest && (
          <Button variant="outline" onClick={() => setTestOpen(true)}>
            <Sparkles className="size-4" />
            Testar prompt
          </Button>
        )}
      </div>

      {!canEdit && (
        <div className="flex items-start gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <span>
            Você pode visualizar as configurações. Para editar, é necessária a permissão
            "Editar configurações de IA".
          </span>
        </div>
      )}

      {settingsQuery.isLoading || metadataQuery.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : settingsQuery.isError || !settingsQuery.data || !metadataQuery.data ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertCircle className="size-8 text-destructive" />
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar as configurações de IA.
            </p>
            <Button size="sm" variant="outline" onClick={() => settingsQuery.refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <SettingsForm settings={settingsQuery.data} canEdit={canEdit} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Campos configuráveis da OS</CardTitle>
              <p className="text-sm text-muted-foreground">
                Defina como a IA se comporta em cada campo. As permissões da IA são
                gerenciadas nas permissões de usuário (módulo "Assistente de IA").
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-[260px_1fr]">
              <div className="space-y-1">
                {instructionsQuery.data?.map((instruction) => (
                  <button
                    key={instruction.id}
                    type="button"
                    onClick={() => setSelected(instruction)}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-accent ${
                      selected?.id === instruction.id ? "bg-accent" : ""
                    }`}
                  >
                    <span>{instruction.field_key_display}</span>
                    {!instruction.is_active && (
                      <Badge variant="muted">Inativo</Badge>
                    )}
                  </button>
                ))}
              </div>
              <div className="rounded-md border p-4">
                {selected ? (
                  <AiFieldInstructionEditor
                    key={selected.id}
                    instruction={
                      instructionsQuery.data?.find((i) => i.id === selected.id) ?? selected
                    }
                    metadata={metadataQuery.data}
                    canEdit={canEdit}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                    <Info className="size-6" />
                    Selecione um campo à esquerda para editar sua instrução.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {canLogs && <LogsSection />}
        </>
      )}

      {testOpen && metadataQuery.data && (
        <TestPromptDialog metadata={metadataQuery.data} onClose={() => setTestOpen(false)} />
      )}
    </div>
  );
}

function SettingsForm({
  settings,
  canEdit,
}: {
  settings: import("../types").AISettings;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => ({ ...settings }));

  const mutation = useMutation({
    mutationFn: () =>
      updateAISettings({
        is_active: form.is_active,
        provider: form.provider,
        model: form.model,
        base_url: form.base_url,
        api_key_env: form.api_key_env,
        temperature: Number(form.temperature),
        max_tokens: Number(form.max_tokens),
        timeout_seconds: Number(form.timeout_seconds),
        global_prompt: form.global_prompt,
        log_texts: form.log_texts,
        retention_days: Number(form.retention_days),
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["ai-settings"] });
      queryClient.invalidateQueries({ queryKey: ["ai-metadata"] });
      setForm({ ...updated });
      toast.success("Configurações de IA salvas.");
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, "Não foi possível salvar as configurações."));
    },
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Status e provedor</CardTitle>
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
      <CardContent className="space-y-4">
        <fieldset disabled={!canEdit} className="space-y-4">
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div>
              <Label htmlFor="ai-active">Assistente de IA ativo</Label>
              <p className="text-xs text-muted-foreground">
                Quando desativado, os botões de IA não aparecem nos campos da OS.
              </p>
            </div>
            <Switch
              id="ai-active"
              checked={form.is_active}
              onCheckedChange={(v) => set("is_active", v)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Provedor</Label>
              <Select
                value={form.provider}
                onValueChange={(v) => set("provider", v as AIProvider)}
              >
                <SelectTrigger aria-label="Provedor de IA">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-model">Modelo</Label>
              <Input
                id="ai-model"
                value={form.model}
                onChange={(e) => set("model", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-key-env">Variável de ambiente da chave de API</Label>
              <Input
                id="ai-key-env"
                placeholder="ANTHROPIC_API_KEY"
                value={form.api_key_env}
                onChange={(e) => set("api_key_env", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {settings.key_configured ? (
                  <span className="text-emerald-600">Chave configurada no servidor.</span>
                ) : (
                  <span className="text-amber-600">
                    Chave não encontrada. Defina a variável de ambiente no servidor.
                  </span>
                )}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-base-url">Endpoint (opcional)</Label>
              <Input
                id="ai-base-url"
                placeholder="Padrão do provedor"
                value={form.base_url}
                onChange={(e) => set("base_url", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="ai-temp">Temperatura</Label>
              <Input
                id="ai-temp"
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={form.temperature}
                onChange={(e) => set("temperature", Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Ignorada em modelos Anthropic Opus (não aceitam temperatura).
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-max-tokens">Máx. de tokens</Label>
              <Input
                id="ai-max-tokens"
                type="number"
                value={form.max_tokens}
                onChange={(e) => set("max_tokens", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-timeout">Timeout (segundos)</Label>
              <Input
                id="ai-timeout"
                type="number"
                value={form.timeout_seconds}
                onChange={(e) => set("timeout_seconds", Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ai-global">Prompt global (regras gerais de comportamento)</Label>
            <Textarea
              id="ai-global"
              value={form.global_prompt}
              onChange={(e) => set("global_prompt", e.target.value)}
              className="min-h-48 text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 rounded-md border px-3 py-2">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={form.log_texts}
                onCheckedChange={(v) => set("log_texts", v)}
                aria-label="Registrar textos no log"
              />
              Registrar textos enviados/retornados no log
            </label>
            <div className="flex items-center gap-2 text-sm">
              <Label htmlFor="ai-retention">Retenção (dias)</Label>
              <Input
                id="ai-retention"
                type="number"
                className="w-24"
                value={form.retention_days}
                onChange={(e) => set("retention_days", Number(e.target.value))}
              />
            </div>
          </div>
        </fieldset>
      </CardContent>
    </Card>
  );
}

function TestPromptDialog({
  metadata,
  onClose,
}: {
  metadata: import("../types").AIMetadata;
  onClose: () => void;
}) {
  const [field, setField] = useState(metadata.fields[0]?.key ?? "");
  const [action, setAction] = useState("improve");
  const [text, setText] = useState("");

  const mutation = useMutation({
    mutationFn: () => testAIPrompt({ field, action, text }),
    onError: (error) => {
      toast.error(extractErrorMessage(error, "Não foi possível gerar o teste."));
    },
  });

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Testar prompt de IA</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Campo</Label>
            <Select value={field} onValueChange={setField}>
              <SelectTrigger aria-label="Campo do teste">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {metadata.fields.map((f) => (
                  <SelectItem key={f.key} value={f.key}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Ação</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger aria-label="Ação do teste">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {metadata.actions.map((a) => (
                  <SelectItem key={a.key} value={a.key}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="test-text">Texto de exemplo</Label>
          <Textarea
            id="test-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-28 text-sm"
          />
        </div>
        <div className="flex justify-end">
          <Button
            disabled={!text.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Gerar
          </Button>
        </div>
        {mutation.data && (
          <div className="space-y-1.5">
            <Label>Resposta da IA</Label>
            <Textarea
              readOnly
              value={mutation.data.suggestion}
              className="min-h-28 bg-muted/30 text-sm"
              aria-label="Resposta do teste"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LogsSection() {
  const logsQuery = useQuery({ queryKey: ["ai-logs"], queryFn: listAIUsageLogs });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Histórico de uso da IA</CardTitle>
      </CardHeader>
      <CardContent>
        {logsQuery.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (logsQuery.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum uso registrado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-4">Data</th>
                  <th className="py-1 pr-4">Campo</th>
                  <th className="py-1 pr-4">Ação</th>
                  <th className="py-1 pr-4">Provedor</th>
                  <th className="py-1 pr-4">Status</th>
                  <th className="py-1">Aplicada</th>
                </tr>
              </thead>
              <tbody>
                {logsQuery.data?.slice(0, 50).map((log) => (
                  <tr key={log.id} className="border-t">
                    <td className="py-1 pr-4 text-muted-foreground">
                      {new Date(log.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="py-1 pr-4">{log.field_key}</td>
                    <td className="py-1 pr-4">{log.action}</td>
                    <td className="py-1 pr-4">{log.provider}</td>
                    <td className="py-1 pr-4">
                      {log.status === "success" ? "Sucesso" : "Falhou"}
                    </td>
                    <td className="py-1">
                      {log.applied === null ? "—" : log.applied ? "Sim" : "Não"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
