import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Eye,
  History,
  Loader2,
  RotateCcw,
  Save,
  Send,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { extractErrorMessage } from "@/lib/api-client";

import {
  getNotificationTemplateHistory,
  restoreNotificationTemplate,
  testSendNotificationTemplate,
  updateNotificationTemplate,
} from "../api";
import type { NotificationMetadata, NotificationTemplate } from "../types";
import { VariablePalette } from "./VariablePalette";

interface EditorProps {
  template: NotificationTemplate;
  metadata: NotificationMetadata;
  canEdit: boolean;
  canTest: boolean;
  onBack: () => void;
}

const VAR_RE = /\{\{\s*([a-zA-Z_][\w]*(?:\.[a-zA-Z_][\w]*)*)\s*\}\}/g;

type FieldName = "subject" | "html_content" | "text_content";

export function NotificationTemplateEditor({
  template,
  metadata,
  canEdit,
  canTest,
  onBack,
}: EditorProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: template.name,
    description: template.description,
    subject: template.subject,
    html_content: template.html_content,
    text_content: template.text_content,
    is_active: template.is_active,
  });
  const [testTo, setTestTo] = useState("");
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const activeField = useRef<{ name: FieldName; el: HTMLTextAreaElement | HTMLInputElement } | null>(
    null,
  );

  const isEmail = template.channel === "email";

  const sampleMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const group of metadata.variables) {
      for (const variable of group.variables) map[variable.key] = variable.example;
    }
    return map;
  }, [metadata]);

  const knownKeys = useMemo(
    () => new Set(Object.keys(sampleMap)),
    [sampleMap],
  );

  const renderSample = (text: string) =>
    text.replace(VAR_RE, (_, key: string) => sampleMap[key] ?? "");

  const unknownVariables = useMemo(() => {
    const found = new Set<string>();
    for (const text of [form.subject, form.html_content, form.text_content]) {
      let match: RegExpExecArray | null;
      VAR_RE.lastIndex = 0;
      while ((match = VAR_RE.exec(text)) !== null) {
        if (!knownKeys.has(match[1])) found.add(match[1]);
      }
    }
    return [...found];
  }, [form, knownKeys]);

  function setField(name: keyof typeof form, value: string | boolean) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function insertVariable(key: string) {
    const token = `{{${key}}}`;
    const target = activeField.current;
    const name: FieldName = target?.name ?? (isEmail ? "html_content" : "text_content");
    const el = target?.el ?? null;
    const current = form[name];
    if (el) {
      const start = el.selectionStart ?? current.length;
      const end = el.selectionEnd ?? current.length;
      const next = current.slice(0, start) + token + current.slice(end);
      setField(name, next);
      requestAnimationFrame(() => {
        el.focus();
        const caret = start + token.length;
        el.setSelectionRange(caret, caret);
      });
    } else {
      setField(name, current + token);
    }
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      updateNotificationTemplate(template.id, {
        name: form.name,
        description: form.description,
        subject: form.subject,
        html_content: form.html_content,
        text_content: form.text_content,
        is_active: form.is_active,
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["notification-templates"] });
      queryClient.setQueryData(["notification-template", template.id], updated);
      toast.success("Template salvo.", { id: "template-save" });
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, "Não foi possível salvar o template."), {
        id: "template-save",
      });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: () => restoreNotificationTemplate(template.id),
    onSuccess: (restored) => {
      setForm({
        name: restored.name,
        description: restored.description,
        subject: restored.subject,
        html_content: restored.html_content,
        text_content: restored.text_content,
        is_active: restored.is_active,
      });
      queryClient.invalidateQueries({ queryKey: ["notification-templates"] });
      setRestoreOpen(false);
      toast.success("Template restaurado para o padrão do sistema.");
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, "Não foi possível restaurar o template."));
      setRestoreOpen(false);
    },
  });

  const testMutation = useMutation({
    mutationFn: () => testSendNotificationTemplate(template.id, testTo.trim()),
    onSuccess: (result) => {
      if (result.status === "sent") {
        toast.success(`Mensagem de teste enviada para ${result.recipient}.`);
      } else if (result.status === "skipped" && result.link) {
        toast.success("Link de WhatsApp gerado (abra para enviar).");
      } else if (result.status === "skipped") {
        toast.info(result.error || "Canal sem envio automático.");
      } else {
        toast.error(result.error || "Falha ao enviar o teste.");
      }
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, "Não foi possível enviar o teste."));
    },
  });

  const historyQuery = useQuery({
    queryKey: ["notification-template", template.id, "history"],
    queryFn: () => getNotificationTemplateHistory(template.id),
    enabled: showHistory,
  });

  const canSave = canEdit && unknownVariables.length === 0;
  const previewHtml = renderSample(form.html_content);
  const previewText = renderSample(form.text_content);
  const previewSubject = renderSample(form.subject);

  function registerField(name: FieldName) {
    return {
      name,
      onFocus: (e: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        activeField.current = { name, el: e.target };
      },
    };
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Todos os templates
      </button>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            {template.event_display}
            <Badge>{template.channel_display}</Badge>
            {template.is_customized && (
              <span className="rounded-full border px-2 py-0.5 text-xs font-normal text-muted-foreground">
                Personalizado
              </span>
            )}
          </h1>
          <p className="text-muted-foreground">{template.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!canEdit || restoreMutation.isPending}
            onClick={() => setRestoreOpen(true)}
          >
            <RotateCcw className="size-4" />
            Restaurar padrão
          </Button>
          <Button
            size="sm"
            disabled={!canSave || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Salvar
          </Button>
        </div>
      </div>

      {!canEdit && (
        <div className="flex items-start gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <span>
            Você não tem permissão para editar templates. É possível apenas visualizar e
            pré-visualizar.
          </span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Coluna do editor */}
        <div className="space-y-4">
          <fieldset disabled={!canEdit} className="space-y-4">
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <Label htmlFor="tpl-active">Template ativo</Label>
                <p className="text-xs text-muted-foreground">
                  Inativo: o sistema usa o padrão de fábrica como fallback seguro.
                </p>
              </div>
              <Switch
                id="tpl-active"
                checked={form.is_active}
                onCheckedChange={(checked) => setField("is_active", checked)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Nome do template</Label>
              <Input
                id="tpl-name"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tpl-description">Descrição</Label>
              <Input
                id="tpl-description"
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
              />
            </div>

            {isEmail && (
              <div className="space-y-1.5">
                <Label htmlFor="tpl-subject">Assunto</Label>
                <Input
                  id="tpl-subject"
                  value={form.subject}
                  onChange={(e) => setField("subject", e.target.value)}
                  {...registerField("subject")}
                />
              </div>
            )}

            {isEmail && (
              <div className="space-y-1.5">
                <Label htmlFor="tpl-html">Conteúdo HTML</Label>
                <Textarea
                  id="tpl-html"
                  value={form.html_content}
                  onChange={(e) => setField("html_content", e.target.value)}
                  {...registerField("html_content")}
                  className="min-h-56 font-mono text-xs"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="tpl-text">
                {isEmail ? "Fallback em texto puro" : "Conteúdo da mensagem"}
              </Label>
              <Textarea
                id="tpl-text"
                value={form.text_content}
                onChange={(e) => setField("text_content", e.target.value)}
                {...registerField("text_content")}
                className="min-h-40 font-mono text-xs"
              />
            </div>
          </fieldset>

          {unknownVariables.length > 0 && (
            <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              Variáveis inexistentes:{" "}
              {unknownVariables.map((key) => `{{${key}}}`).join(", ")}. Corrija antes de
              salvar.
            </div>
          )}

          <VariablePalette
            groups={metadata.variables}
            onInsert={insertVariable}
            disabled={!canEdit}
          />
        </div>

        {/* Coluna de pré-visualização e ações */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Eye className="size-4 text-primary" />
                Pré-visualização (dados simulados)
              </CardTitle>
              {isEmail && previewSubject && (
                <p className="text-sm text-muted-foreground">
                  Assunto: <span className="font-medium text-foreground">{previewSubject}</span>
                </p>
              )}
            </CardHeader>
            <CardContent>
              {isEmail ? (
                <iframe
                  title="Pré-visualização do e-mail"
                  className="h-96 w-full rounded-md border bg-white"
                  sandbox=""
                  srcDoc={previewHtml}
                />
              ) : (
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm">
                  {previewText}
                </pre>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Send className="size-4 text-primary" />
                Enviar mensagem de teste
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {template.channel === "email"
                  ? "Informe um e-mail para receber uma amostra."
                  : "Informe um telefone/WhatsApp para gerar a amostra."}
              </p>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Input
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder={template.channel === "email" ? "email@exemplo.com" : "(11) 99999-9999"}
                aria-label="Destinatário do teste"
              />
              <Button
                disabled={!canTest || !testTo.trim() || testMutation.isPending}
                onClick={() => testMutation.mutate()}
              >
                {testMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Enviar teste
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <button
                type="button"
                className="flex w-full items-center gap-2 text-left text-base font-semibold"
                onClick={() => setShowHistory((prev) => !prev)}
              >
                <History className="size-4 text-primary" />
                Histórico de alterações
              </button>
            </CardHeader>
            {showHistory && (
              <CardContent>
                {historyQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando…</p>
                ) : (historyQuery.data?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma alteração registrada ainda.
                  </p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {historyQuery.data?.map((entry, index) => (
                      <li key={index} className="flex flex-col border-b pb-2 last:border-0">
                        <span className="text-muted-foreground">
                          {new Date(entry.created_at).toLocaleString("pt-BR")} ·{" "}
                          {entry.actor ?? "Sistema"}
                        </span>
                        <span>
                          {entry.action === "notification.template.restore"
                            ? "Restaurou o padrão"
                            : `Alterou: ${entry.changed.join(", ") || "—"}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      <AlertDialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar o template padrão?</AlertDialogTitle>
            <AlertDialogDescription>
              O conteúdo atual (assunto, HTML e texto) será substituído pelo template padrão
              de fábrica deste evento. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={restoreMutation.isPending}
              onClick={() => restoreMutation.mutate()}
            >
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
