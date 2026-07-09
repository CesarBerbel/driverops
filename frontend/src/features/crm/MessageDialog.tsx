import { Loader2, Mail, MessageCircle, Phone, Send, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { usePermissionCheck } from "@/features/auth/usePermission";
import { extractErrorMessage } from "@/lib/api-client";
import { onlyDigits } from "@/lib/masks";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

import { generateMessage, markSent, updateSuggestion } from "./api";
import type { Suggestion } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestion: Suggestion;
  onChanged: (s: Suggestion) => void;
}

export function MessageDialog({ open, onOpenChange, suggestion, onChanged }: Props) {
  const can = usePermissionCheck();
  const [text, setText] = useState(suggestion.suggested_text);
  const [generating, setGenerating] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setText(suggestion.suggested_text);
      setAiNote(null);
    }
  }, [open, suggestion]);

  async function handleGenerate() {
    setGenerating(true);
    setAiNote(null);
    try {
      const result = await generateMessage(suggestion.id);
      setText(result.text);
      if (!result.ai_used) {
        setAiNote(
          result.reason === "ai_disabled" || result.reason === "crm_ai_disabled"
            ? "IA indisponível no momento — usando o texto sugerido pelo sistema."
            : "Não foi possível usar a IA agora — usando o texto sugerido pelo sistema.",
        );
      }
    } catch (e) {
      toast.error(extractErrorMessage(e, "Não foi possível gerar a mensagem."));
    } finally {
      setGenerating(false);
    }
  }

  async function persist(): Promise<void> {
    if (text !== suggestion.suggested_text) {
      onChanged(await updateSuggestion(suggestion.id, { suggested_text: text }));
    }
  }

  async function openChannel(channel: "whatsapp" | "email" | "phone") {
    await persist();
    const phone = suggestion.customer_whatsapp || suggestion.customer_phone;
    if (channel === "whatsapp" && phone) {
      window.open(`${buildWhatsAppUrl(phone)}?text=${encodeURIComponent(text)}`, "_blank");
    } else if (channel === "email" && suggestion.customer_email) {
      window.open(
        `mailto:${suggestion.customer_email}?body=${encodeURIComponent(text)}`,
        "_blank",
      );
    } else if (channel === "phone" && phone) {
      window.open(`tel:${onlyDigits(phone)}`, "_blank");
    } else {
      toast.error("O cliente não tem esse canal cadastrado.");
      return;
    }
    if (can("crm.send_message")) {
      onChanged(await markSent(suggestion.id, { channel }));
    }
  }

  const canSend = can("crm.send_message") || can("crm.manage");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Mensagem sugerida</DialogTitle>
          <DialogDescription>
            Revise o texto antes de enviar. Nada é enviado automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {can("crm.use_ai") && (
            <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating}>
              {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Gerar com IA
            </Button>
          )}
          {aiNote && <p className="text-xs text-amber-600">{aiNote}</p>}
          <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-32" />

          {canSend && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => openChannel("whatsapp")}>
                <MessageCircle className="size-4" /> WhatsApp
              </Button>
              <Button size="sm" variant="outline" onClick={() => openChannel("email")}>
                <Mail className="size-4" /> E-mail
              </Button>
              <Button size="sm" variant="outline" onClick={() => openChannel("phone")}>
                <Phone className="size-4" /> Ligar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await persist();
                  onChanged(await markSent(suggestion.id));
                  toast.success("Registrada como enviada.");
                  onOpenChange(false);
                }}
              >
                <Send className="size-4" /> Marcar enviada
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
