import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  Check,
  FileText,
  Link2,
  Mail,
  PenLine,
  Plus,
  Signature,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { extractErrorMessage } from "@/lib/api-client";
import { formatCurrencyBRL } from "@/lib/masks";
import { cn } from "@/lib/utils";

import {
  approveQuotePhysical,
  approveQuoteTablet,
  cancelQuote,
  createQuote,
  listQuotes,
  openQuotePdf,
  rejectQuote,
  sendQuote,
} from "../api";
import { formatDateTimeBr, quoteStatusClass } from "../quoteStatus";
import type { Quote } from "../types";
import { TabletSignatureDialog } from "./TabletSignatureDialog";

interface QuotePanelProps {
  orderId: number;
}

const TERMINAL = ["approved", "rejected", "expired", "canceled"];

export function QuotePanel({ orderId }: QuotePanelProps) {
  const queryClient = useQueryClient();
  const quotesKey = ["quotes", orderId];

  const { data: quotes, isLoading } = useQuery({
    queryKey: quotesKey,
    queryFn: () => listQuotes(orderId),
  });

  // Dialog state shared by the simpler flows.
  const [sendTarget, setSendTarget] = useState<Quote | null>(null);
  const [sendEmail, setSendEmail] = useState("");
  const [physicalTarget, setPhysicalTarget] = useState<Quote | null>(null);
  const [physicalName, setPhysicalName] = useState("");
  const [physicalNote, setPhysicalNote] = useState("");
  const [tabletTarget, setTabletTarget] = useState<Quote | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Quote | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: quotesKey });
    // A aprovação pode mudar o status da OS -- atualiza as telas da OS.
    queryClient.invalidateQueries({ queryKey: ["work-orders"] });
  }

  function onError(error: unknown) {
    toast.error(extractErrorMessage(error, "Não foi possível concluir a ação."));
  }

  const createMutation = useMutation({
    mutationFn: () => createQuote(orderId),
    onSuccess: () => {
      invalidate();
      toast.success("Orçamento criado.", { id: "quote-created" });
    },
    onError,
  });

  const sendMutation = useMutation({
    mutationFn: ({ id, email }: { id: number; email: string }) => sendQuote(id, email),
    onSuccess: () => {
      invalidate();
      setSendTarget(null);
      toast.success("Orçamento enviado por e-mail.", { id: "quote-sent" });
    },
    onError,
  });

  const physicalMutation = useMutation({
    mutationFn: ({ id, name, note }: { id: number; name: string; note: string }) =>
      approveQuotePhysical(id, { client_name: name, note }),
    onSuccess: () => {
      invalidate();
      setPhysicalTarget(null);
      toast.success("Orçamento aprovado (assinatura física).", { id: "quote-approved" });
    },
    onError,
  });

  const tabletMutation = useMutation({
    mutationFn: ({ id, name, signature }: { id: number; name: string; signature: string }) =>
      approveQuoteTablet(id, { client_name: name, signature }),
    onSuccess: () => {
      invalidate();
      setTabletTarget(null);
      toast.success("Orçamento aprovado (assinatura no tablet).", { id: "quote-approved" });
    },
    onError,
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => rejectQuote(id, reason),
    onSuccess: () => {
      invalidate();
      setRejectTarget(null);
      toast.success("Orçamento recusado.", { id: "quote-rejected" });
    },
    onError,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => cancelQuote(id),
    onSuccess: () => {
      invalidate();
      toast.success("Orçamento cancelado.", { id: "quote-canceled" });
    },
    onError,
  });

  async function handlePdf(quote: Quote) {
    try {
      await openQuotePdf(quote.id);
    } catch (error) {
      onError(error);
    }
  }

  function copyLink(quote: Quote) {
    const link = `${window.location.origin}/orcamento/${quote.public_token}`;
    navigator.clipboard?.writeText(link);
    toast.success("Link de aprovação copiado.", { id: "quote-link" });
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Orçamentos</h2>
            <p className="text-sm text-muted-foreground">
              Gere o orçamento a partir dos itens da OS, envie para aprovação e registre a
              decisão do cliente.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
          >
            <Plus className="size-4" />
            Criar orçamento
          </Button>
        </div>

        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (quotes ?? []).length === 0 ? (
          <p className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
            Nenhum orçamento gerado ainda. Clique em "Criar orçamento" para gerar a partir
            dos itens da OS.
          </p>
        ) : (
          <ul className="space-y-3">
            {(quotes ?? []).map((quote) => {
              const terminal = TERMINAL.includes(quote.status);
              return (
                <li key={quote.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        Orçamento {String(quote.number).padStart(4, "0")}
                      </span>
                      <span className="text-xs text-muted-foreground">v{quote.version}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          quoteStatusClass(quote.status),
                        )}
                      >
                        {quote.status_display}
                      </span>
                    </div>
                    <span className="text-sm font-semibold">
                      {formatCurrencyBRL(Number(quote.totals.final_value))}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Criado por {quote.created_by_name || "—"} em{" "}
                    {formatDateTimeBr(quote.created_at)}
                    {quote.sent_at && ` · Enviado em ${formatDateTimeBr(quote.sent_at)}`}
                  </p>

                  {terminal && quote.status === "approved" && (
                    <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                      Aprovado por {quote.client_name} · {quote.channel_display} ·{" "}
                      {formatDateTimeBr(quote.decided_at)}
                      {quote.decision_ip && ` · IP ${quote.decision_ip}`}
                    </p>
                  )}
                  {quote.status === "rejected" && (
                    <p className="mt-1 text-xs text-red-700 dark:text-red-400">
                      Recusado {quote.decided_at && `em ${formatDateTimeBr(quote.decided_at)}`}
                      {quote.rejection_reason && ` · ${quote.rejection_reason}`}
                    </p>
                  )}
                  {quote.signature_image && (
                    <img
                      src={quote.signature_image}
                      alt="Assinatura do cliente"
                      className="mt-2 h-16 rounded border bg-white"
                    />
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => handlePdf(quote)}>
                      <FileText className="size-4" />
                      Gerar PDF
                    </Button>
                    {(quote.status === "sent" || quote.status === "viewed") && (
                      <Button variant="outline" size="sm" onClick={() => copyLink(quote)}>
                        <Link2 className="size-4" />
                        Copiar link
                      </Button>
                    )}
                    {!terminal && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSendEmail(quote.customer_email ?? "");
                            setSendTarget(quote);
                          }}
                        >
                          <Mail className="size-4" />
                          Enviar por e-mail
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPhysicalName(quote.customer_name ?? "");
                            setPhysicalNote("");
                            setPhysicalTarget(quote);
                          }}
                        >
                          <PenLine className="size-4" />
                          Aprovar presencial
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setTabletTarget(quote)}
                        >
                          <Signature className="size-4" />
                          Assinar no tablet
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setRejectReason("");
                            setRejectTarget(quote);
                          }}
                        >
                          <X className="size-4" />
                          Recusar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => cancelMutation.mutate(quote.id)}
                          disabled={cancelMutation.isPending}
                        >
                          <Ban className="size-4" />
                          Cancelar
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      {/* Enviar por e-mail */}
      <Dialog open={sendTarget !== null} onOpenChange={(o) => !o && setSendTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar orçamento por e-mail</DialogTitle>
            <DialogDescription>
              Um link seguro de aprovação será enviado ao cliente. Ele poderá aprovar ou
              recusar sem precisar fazer login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="send-email">E-mail do cliente</Label>
            <Input
              id="send-email"
              type="email"
              value={sendEmail}
              onChange={(event) => setSendEmail(event.target.value)}
              placeholder="cliente@email.com"
            />
          </div>
          <DialogFooter className="flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setSendTarget(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!sendEmail.trim() || sendMutation.isPending}
              onClick={() =>
                sendTarget &&
                sendMutation.mutate({ id: sendTarget.id, email: sendEmail.trim() })
              }
            >
              <Mail className="size-4" />
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Aprovar presencial (assinatura física) */}
      <Dialog
        open={physicalTarget !== null}
        onOpenChange={(o) => !o && setPhysicalTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Aprovação com assinatura física</DialogTitle>
            <DialogDescription>
              Registre a aprovação presencial após o cliente assinar o orçamento impresso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="physical-name">Nome do cliente</Label>
              <Input
                id="physical-name"
                value={physicalName}
                onChange={(event) => setPhysicalName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="physical-note">Observação (opcional)</Label>
              <Textarea
                id="physical-note"
                rows={2}
                value={physicalNote}
                onChange={(event) => setPhysicalNote(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setPhysicalTarget(null)}>
              Cancelar
            </Button>
            <Button
              disabled={physicalMutation.isPending}
              onClick={() =>
                physicalTarget &&
                physicalMutation.mutate({
                  id: physicalTarget.id,
                  name: physicalName.trim(),
                  note: physicalNote.trim(),
                })
              }
            >
              <Check className="size-4" />
              Confirmar aprovação
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
            <Label htmlFor="reject-reason">Motivo (opcional)</Label>
            <Textarea
              id="reject-reason"
              rows={3}
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
            />
          </div>
          <DialogFooter className="flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              disabled={rejectMutation.isPending}
              onClick={() =>
                rejectTarget &&
                rejectMutation.mutate({ id: rejectTarget.id, reason: rejectReason.trim() })
              }
            >
              Recusar orçamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Aprovar no tablet (assinatura digital) */}
      <TabletSignatureDialog
        quote={tabletTarget}
        open={tabletTarget !== null}
        onOpenChange={(o) => !o && setTabletTarget(null)}
        isPending={tabletMutation.isPending}
        onConfirm={(name, signature) =>
          tabletTarget &&
          tabletMutation.mutate({ id: tabletTarget.id, name, signature })
        }
      />
    </Card>
  );
}
