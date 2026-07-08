import { useMutation } from "@tanstack/react-query";
import { Copy, Loader2, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { extractErrorMessage } from "@/lib/api-client";

import { generateAISuggestion, markAIUsageOutcome } from "../api";
import type { AIActionMeta, AISuggestion } from "../types";
import { useAiAvailability } from "../useAiAvailability";

interface AiFieldActionsProps {
  fieldKey: string;
  value: string;
  onApply: (text: string) => void;
  workOrderId?: number;
  disabled?: boolean;
}

const CAP_BY_FLAG: Record<string, keyof import("../types").AIFieldMeta> = {
  can_rewrite: "can_rewrite",
  can_fix_grammar: "can_fix_grammar",
  can_summarize: "can_summarize",
  can_expand: "can_expand",
};

/**
 * Ações de IA para um campo de texto da OS. Renderiza um botão/menu discreto;
 * ao gerar, abre um diálogo comparando o texto original com a sugestão. O texto
 * original NUNCA é substituído automaticamente — só ao clicar em "Aplicar".
 */
export function AiFieldActions({
  fieldKey,
  value,
  onApply,
  workOrderId,
  disabled,
}: AiFieldActionsProps) {
  const { enabled, metadata } = useAiAvailability();
  const [open, setOpen] = useState(false);
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const fieldMeta = metadata?.fields.find((f) => f.key === fieldKey);

  const mutation = useMutation({
    mutationFn: (action: string) =>
      generateAISuggestion({
        field: fieldKey,
        action,
        text: value,
        work_order: workOrderId,
      }),
    onSuccess: (result) => {
      setSuggestion(result);
      setOpen(true);
    },
    onError: (error) => {
      // Falha de IA: o texto original é preservado; apenas avisamos.
      toast.error(
        extractErrorMessage(
          error,
          "Não foi possível gerar a sugestão agora. O texto original foi preservado.",
        ),
      );
    },
  });

  if (!enabled || !fieldMeta || fieldMeta.active === false) return null;

  const availableActions: AIActionMeta[] = (metadata?.actions ?? []).filter(
    (action) => {
      if (!action.required_flag) return true;
      const capKey = CAP_BY_FLAG[action.required_flag];
      return capKey ? Boolean(fieldMeta[capKey]) : false;
    },
  );

  function runAction(action: string) {
    setLastAction(action);
    if (!value.trim()) {
      toast.info("Escreva um texto no campo antes de usar a IA.");
      return;
    }
    mutation.mutate(action);
  }

  function recordOutcome(applied: boolean) {
    if (suggestion?.log_id) {
      markAIUsageOutcome(suggestion.log_id, applied).catch(() => {});
    }
  }

  function handleApply() {
    if (suggestion) {
      onApply(suggestion.suggestion);
      recordOutcome(true);
      toast.success("A sugestão foi aplicada ao campo.");
    }
    setOpen(false);
  }

  function handleDiscard() {
    recordOutcome(false);
    setOpen(false);
    toast("A ação foi cancelada. Nenhuma alteração foi feita.");
  }

  async function handleCopy() {
    if (suggestion) {
      await navigator.clipboard.writeText(suggestion.suggestion).catch(() => {});
      toast.success("Sugestão copiada.");
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || mutation.isPending}
            aria-label="Ações de IA para o campo"
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            IA
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {availableActions.map((action) => (
            <DropdownMenuItem
              key={action.key}
              onSelect={() => runAction(action.key)}
            >
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : handleDiscard())}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              Sugestão da IA
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <span>
              A IA pode cometer erros. Revise a sugestão antes de aplicar — o texto
              original é preservado até você clicar em "Aplicar".
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Texto original</p>
              <Textarea
                readOnly
                value={value}
                className="min-h-40 bg-muted/30 text-sm"
                aria-label="Texto original"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Sugestão</p>
              <Textarea
                readOnly
                value={suggestion?.suggestion ?? ""}
                className="min-h-40 text-sm"
                aria-label="Texto sugerido"
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              <Copy className="size-4" />
              Copiar
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={mutation.isPending || !lastAction}
              onClick={() => lastAction && mutation.mutate(lastAction)}
            >
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Gerar novamente
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDiscard}>
              Descartar
            </Button>
            <Button size="sm" onClick={handleApply}>
              Aplicar sugestão
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
