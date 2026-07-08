import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { extractErrorMessage } from "@/lib/api-client";

import { restoreAIFieldInstruction, updateAIFieldInstruction } from "../api";
import type { AIFieldInstruction, AIMetadata } from "../types";

interface EditorProps {
  instruction: AIFieldInstruction;
  metadata: AIMetadata;
  canEdit: boolean;
}

const TOGGLES: { key: keyof AIFieldInstruction; label: string }[] = [
  { key: "can_rewrite", label: "Pode reescrever" },
  { key: "can_fix_grammar", label: "Pode corrigir ortografia/gramática" },
  { key: "can_summarize", label: "Pode resumir" },
  { key: "can_expand", label: "Pode expandir/detalhar" },
  { key: "preserve_technical_terms", label: "Preservar termos técnicos" },
  { key: "keep_first_person", label: "Manter primeira pessoa do cliente" },
  { key: "remove_slang", label: "Remover gírias" },
  { key: "visible_to_customer", label: "Texto visível ao cliente" },
];

export function AiFieldInstructionEditor({ instruction, metadata, canEdit }: EditorProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => ({ ...instruction }));
  const [restoreOpen, setRestoreOpen] = useState(false);

  function setField<K extends keyof AIFieldInstruction>(
    key: K,
    value: AIFieldInstruction[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleContext(group: string, checked: boolean) {
    setForm((prev) => {
      const set = new Set(prev.allowed_context);
      if (checked) set.add(group);
      else set.delete(group);
      return { ...prev, allowed_context: [...set] };
    });
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      updateAIFieldInstruction(instruction.id, {
        instruction: form.instruction,
        tone: form.tone,
        detail_level: form.detail_level,
        audience: form.audience,
        can_rewrite: form.can_rewrite,
        can_fix_grammar: form.can_fix_grammar,
        can_summarize: form.can_summarize,
        can_expand: form.can_expand,
        use_context: form.use_context,
        allowed_context: form.allowed_context,
        preserve_technical_terms: form.preserve_technical_terms,
        keep_first_person: form.keep_first_person,
        remove_slang: form.remove_slang,
        visible_to_customer: form.visible_to_customer,
        is_active: form.is_active,
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["ai-field-instructions"] });
      queryClient.invalidateQueries({ queryKey: ["ai-metadata"] });
      setForm({ ...updated });
      toast.success("Instrução salva.");
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, "Não foi possível salvar a instrução."));
    },
  });

  const restoreMutation = useMutation({
    mutationFn: () => restoreAIFieldInstruction(instruction.id),
    onSuccess: (restored) => {
      queryClient.invalidateQueries({ queryKey: ["ai-field-instructions"] });
      setForm({ ...restored });
      setRestoreOpen(false);
      toast.success("Instrução restaurada para o padrão.");
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, "Não foi possível restaurar."));
      setRestoreOpen(false);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{instruction.field_key_display}</h3>
          <p className="text-sm text-muted-foreground">{instruction.description}</p>
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
            disabled={!canEdit || saveMutation.isPending}
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

      <fieldset disabled={!canEdit} className="space-y-4">
        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <Label htmlFor="field-active">IA ativa neste campo</Label>
          <Switch
            id="field-active"
            checked={form.is_active}
            onCheckedChange={(v) => setField("is_active", v)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="field-instruction">Instrução principal da IA</Label>
          <Textarea
            id="field-instruction"
            value={form.instruction}
            onChange={(e) => setField("instruction", e.target.value)}
            className="min-h-40 text-sm"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Tom de linguagem</Label>
            <Select value={form.tone} onValueChange={(v) => setField("tone", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {metadata.tones.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Nível de detalhamento</Label>
            <Select
              value={form.detail_level}
              onValueChange={(v) => setField("detail_level", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {metadata.detail_levels.map((d) => (
                  <SelectItem key={d.key} value={d.key}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Público-alvo</Label>
            <Select value={form.audience} onValueChange={(v) => setField("audience", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {metadata.audiences.map((a) => (
                  <SelectItem key={a.key} value={a.key}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {TOGGLES.map((toggle) => (
            <label
              key={toggle.key}
              className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <Checkbox
                checked={Boolean(form[toggle.key])}
                onCheckedChange={(v) =>
                  setField(toggle.key, v as AIFieldInstruction[typeof toggle.key])
                }
                aria-label={toggle.label}
              />
              {toggle.label}
            </label>
          ))}
        </div>

        <div className="space-y-2 rounded-md border p-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="use-context">Pode usar dados relacionados da OS</Label>
            <Switch
              id="use-context"
              checked={form.use_context}
              onCheckedChange={(v) => setField("use_context", v)}
            />
          </div>
          {form.use_context && (
            <div className="flex flex-wrap gap-2 pt-1">
              {metadata.context_groups.map((group) => {
                const checked = form.allowed_context.includes(group.key);
                return (
                  <label
                    key={group.key}
                    className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => toggleContext(group.key, v)}
                      aria-label={group.label}
                    />
                    {group.label}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </fieldset>

      <AlertDialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar a instrução padrão?</AlertDialogTitle>
            <AlertDialogDescription>
              A instrução e as configurações deste campo voltarão ao padrão de fábrica.
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
