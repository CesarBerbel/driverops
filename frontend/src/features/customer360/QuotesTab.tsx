import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, ExternalLink, FileText, Link2, Mail, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { usePermissionCheck } from "@/features/auth/usePermission";
import {
  cancelQuote,
  openQuotePdf,
  rejectQuote,
  sendQuote,
} from "@/features/quotes/api";
import { extractErrorMessage } from "@/lib/api-client";

import { getCustomerQuotes } from "./api";
import type { QuoteRow } from "./types";

// Mesma regra da aba de orçamentos da OS: em aberto = rascunho/enviado/visto.
const OPEN = ["draft", "sent", "viewed"];

export function Customer360QuotesTab({
  id,
  customerEmail,
}: {
  id: number;
  customerEmail: string;
}) {
  const can = usePermissionCheck();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["c360-quotes", id],
    queryFn: () => getCustomerQuotes(id),
  });

  const [sendTarget, setSendTarget] = useState<QuoteRow | null>(null);
  const [sendEmail, setSendEmail] = useState("");
  const [rejectTarget, setRejectTarget] = useState<QuoteRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["c360-quotes", id] });
    queryClient.invalidateQueries({ queryKey: ["c360", id] });
  }
  function onError(e: unknown) {
    toast.error(extractErrorMessage(e, "Não foi possível concluir a ação."));
  }

  const sendMut = useMutation({
    mutationFn: ({ quoteId, email }: { quoteId: number; email: string }) =>
      sendQuote(quoteId, email),
    onSuccess: () => {
      invalidate();
      setSendTarget(null);
      toast.success("Orçamento enviado por e-mail.");
    },
    onError,
  });

  const rejectMut = useMutation({
    mutationFn: ({ quoteId, reason }: { quoteId: number; reason: string }) =>
      rejectQuote(quoteId, reason),
    onSuccess: () => {
      invalidate();
      setRejectTarget(null);
      toast.success("Orçamento recusado.");
    },
    onError,
  });

  const cancelMut = useMutation({
    mutationFn: (quoteId: number) => cancelQuote(quoteId),
    onSuccess: () => {
      invalidate();
      toast.success("Orçamento cancelado.");
    },
    onError,
  });

  async function handlePdf(q: QuoteRow) {
    try {
      await openQuotePdf(q.id);
    } catch (e) {
      onError(e);
    }
  }

  function copyLink(q: QuoteRow) {
    navigator.clipboard?.writeText(`${window.location.origin}/orcamento/${q.public_token}`);
    toast.success("Link de aprovação copiado.");
  }

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!data || data.length === 0)
    return (
      <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">
        Nenhum orçamento para este cliente.
      </p>
    );

  return (
    <div className="space-y-2">
      {data.map((q) => {
        const isOpen = OPEN.includes(q.status);
        return (
          <div key={q.id} className="space-y-2 rounded-md border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">Orçamento #{q.number}</span>
                <span className="text-xs text-muted-foreground">
                  v{q.version} · {q.vehicle_plate}
                </span>
                <Badge variant="outline">{q.status_display}</Badge>
              </div>
              <span className="font-semibold">R$ {q.final_value}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {q.work_order && (
                <Button asChild variant="ghost" size="sm">
                  <Link to={`/orders/${q.work_order}`}>
                    <ExternalLink className="size-4" /> Abrir na OS
                  </Link>
                </Button>
              )}
              {can("quotes.pdf") && (
                <Button variant="outline" size="sm" onClick={() => handlePdf(q)}>
                  <FileText className="size-4" /> Gerar PDF
                </Button>
              )}
              {can("quotes.send") && (q.status === "sent" || q.status === "viewed") && (
                <Button variant="outline" size="sm" onClick={() => copyLink(q)}>
                  <Link2 className="size-4" /> Copiar link
                </Button>
              )}
              {isOpen && can("quotes.send") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSendEmail(customerEmail);
                    setSendTarget(q);
                  }}
                >
                  <Mail className="size-4" /> Enviar por e-mail
                </Button>
              )}
              {isOpen && can("quotes.reject") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setRejectReason("");
                    setRejectTarget(q);
                  }}
                >
                  <X className="size-4" /> Recusar
                </Button>
              )}
              {isOpen && can("quotes.cancel") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => cancelMut.mutate(q.id)}
                  disabled={cancelMut.isPending}
                >
                  <Ban className="size-4" /> Cancelar
                </Button>
              )}
            </div>
          </div>
        );
      })}

      {/* Enviar por e-mail */}
      <Dialog open={sendTarget !== null} onOpenChange={(o) => !o && setSendTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar orçamento por e-mail</DialogTitle>
            <DialogDescription>
              Um link seguro de aprovação será enviado ao cliente. Ele poderá aprovar ou recusar
              sem precisar fazer login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="c360-send-email">E-mail do cliente</Label>
            <Input
              id="c360-send-email"
              type="email"
              value={sendEmail}
              onChange={(e) => setSendEmail(e.target.value)}
              placeholder="cliente@email.com"
            />
          </div>
          <DialogFooter className="flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setSendTarget(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!sendEmail.trim() || sendMut.isPending}
              onClick={() =>
                sendTarget &&
                sendMut.mutate({ quoteId: sendTarget.id, email: sendEmail.trim() })
              }
            >
              <Mail className="size-4" /> Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recusar */}
      <Dialog open={rejectTarget !== null} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recusar orçamento</DialogTitle>
            <DialogDescription>
              Informe o motivo (opcional) da recusa. O orçamento ficará marcado como recusado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="c360-reject-reason">Motivo (opcional)</Label>
            <Textarea
              id="c360-reject-reason"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter className="flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              disabled={rejectMut.isPending}
              onClick={() =>
                rejectTarget &&
                rejectMut.mutate({ quoteId: rejectTarget.id, reason: rejectReason.trim() })
              }
            >
              Recusar orçamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
