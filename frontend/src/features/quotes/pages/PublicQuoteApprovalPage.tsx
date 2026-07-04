import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatBrDate } from "@/features/dashboard/osStatus";
import { formatPlateForDisplay } from "@/features/vehicles/plate";
import { extractErrorMessage } from "@/lib/api-client";
import { formatCurrencyBRL } from "@/lib/masks";

import { approvePublicQuote, getPublicQuote, rejectPublicQuote } from "../api";
import type { PublicQuote, QuoteItem } from "../types";

function money(value: string) {
  return formatCurrencyBRL(Number(value));
}

function ItemGroup({ title, items }: { title: string; items: QuoteItem[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold">{title}</h3>
      <table className="w-full text-sm">
        <tbody>
          {items.map((item, index) => (
            <tr key={index} className="border-b last:border-0">
              <td className="py-1.5">
                {item.description}
                {item.is_custom && (
                  <span className="ml-1 text-[10px] uppercase text-muted-foreground">
                    avulso
                  </span>
                )}
              </td>
              <td className="py-1.5 text-right text-muted-foreground whitespace-nowrap">
                {item.quantity}× {money(item.unit_price)}
              </td>
              <td className="py-1.5 pl-3 text-right font-medium whitespace-nowrap">
                {money(item.subtotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Terms({ title, text }: { title: string; text: string }) {
  if (!text) return null;
  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold">{title}</h3>
      <p className="text-xs whitespace-pre-line text-muted-foreground">{text}</p>
    </div>
  );
}

export function PublicQuoteApprovalPage() {
  const { token = "" } = useParams();
  const queryClient = useQueryClient();
  const quoteKey = ["public-quote", token];

  const { data, isLoading, isError } = useQuery({
    queryKey: quoteKey,
    queryFn: () => getPublicQuote(token),
    retry: false,
  });

  const [clientName, setClientName] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [reason, setReason] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const approveMutation = useMutation({
    mutationFn: () => approvePublicQuote(token, { client_name: clientName.trim(), terms_accepted: termsAccepted }),
    onSuccess: (updated) => queryClient.setQueryData(quoteKey, updated),
    onError: (error) => setErrorMsg(extractErrorMessage(error, "Não foi possível aprovar.")),
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectPublicQuote(token, { client_name: clientName.trim(), reason: reason.trim() }),
    onSuccess: (updated) => queryClient.setQueryData(quoteKey, updated),
    onError: (error) => setErrorMsg(extractErrorMessage(error, "Não foi possível recusar.")),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <CenteredMessage
        icon={<AlertTriangle className="size-10 text-amber-500" />}
        title="Link inválido ou expirado"
        description="Não encontramos este orçamento. Verifique o link recebido ou entre em contato com a oficina."
      />
    );
  }

  const q: PublicQuote = data;
  const canDecide = q.can_decide;

  return (
    <div className="min-h-svh bg-muted/30 py-6">
      <div className="mx-auto max-w-2xl space-y-5 px-4">
        {/* Cabeçalho da oficina */}
        <header className="rounded-xl border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {q.workshop.logo && (
                <img src={q.workshop.logo} alt="" className="max-h-14 rounded" />
              )}
              <div>
                <h1 className="text-lg font-semibold">
                  {q.workshop.trade_name || "Orçamento"}
                </h1>
                {q.workshop.legal_name && (
                  <p className="text-xs text-muted-foreground">{q.workshop.legal_name}</p>
                )}
                {(q.workshop.phone || q.workshop.email) && (
                  <p className="text-xs text-muted-foreground">
                    {q.workshop.phone} {q.workshop.email && `· ${q.workshop.email}`}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p className="text-sm font-semibold text-foreground">
                Orçamento {String(q.number).padStart(4, "0")}
              </p>
              <p>OS {String(q.work_order_number).padStart(4, "0")} · v{q.version}</p>
              {q.valid_until && <p>Válido até {formatBrDate(q.valid_until)}</p>}
            </div>
          </div>
        </header>

        <StatusBanner quote={q} />

        {/* Cliente e veículo */}
        <section className="rounded-xl border bg-card p-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Cliente</p>
              <p className="font-medium">{q.customer_name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Veículo</p>
              <p className="font-medium">
                {formatPlateForDisplay(q.vehicle_plate)}
                {q.vehicle_description && ` · ${q.vehicle_description}`}
              </p>
            </div>
          </div>
          {q.customer_report && (
            <div className="mt-3">
              <p className="text-xs text-muted-foreground">Relato do cliente</p>
              <p className="text-sm">{q.customer_report}</p>
            </div>
          )}
          {q.diagnosis && (
            <div className="mt-3">
              <p className="text-xs text-muted-foreground">Diagnóstico</p>
              <p className="text-sm">{q.diagnosis}</p>
            </div>
          )}
        </section>

        {/* Itens */}
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <ItemGroup title="Serviços" items={q.items.filter((i) => i.kind === "service")} />
          <ItemGroup title="Pacotes" items={q.items.filter((i) => i.kind === "package")} />
          <ItemGroup title="Peças" items={q.items.filter((i) => i.kind === "part")} />

          <div className="space-y-1 border-t pt-3 text-sm">
            <Row label="Total de serviços" value={money(q.totals.services_total)} />
            <Row label="Total de pacotes" value={money(q.totals.packages_total)} />
            <Row label="Total de peças" value={money(q.totals.parts_total)} />
            <Row label="Total bruto" value={money(q.totals.gross_total)} />
            {q.discount_type !== "none" && Number(q.totals.discount_value) > 0 && (
              <Row label="Desconto" value={`- ${money(q.totals.discount_value)}`} />
            )}
            <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
              <span>Valor final</span>
              <span className="text-primary">{money(q.totals.final_value)}</span>
            </div>
          </div>
        </section>

        {/* Termos */}
        {(q.terms.quote_terms || q.terms.warranty_terms || q.terms.service_authorization_terms) && (
          <section className="space-y-4 rounded-xl border bg-card p-5">
            <Terms title="Termo de orçamento" text={q.terms.quote_terms} />
            <Terms title="Termo de garantia" text={q.terms.warranty_terms} />
            <Terms title="Autorização de serviço" text={q.terms.service_authorization_terms} />
          </section>
        )}

        {/* Ações de aprovação */}
        {canDecide && (
          <section className="space-y-4 rounded-xl border bg-card p-5">
            <div className="space-y-2">
              <Label htmlFor="public-name">Seu nome</Label>
              <Input
                id="public-name"
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                placeholder="Nome completo"
              />
            </div>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
                className="mt-0.5 size-4 accent-primary"
              />
              <span>
                Li e concordo com os termos apresentados e autorizo a execução dos serviços
                descritos neste orçamento.
              </span>
            </label>

            {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}

            <div className="flex flex-col gap-2 sm:flex-row">
              {/* Aprovar */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    className="flex-1"
                    disabled={!clientName.trim() || !termsAccepted || approveMutation.isPending}
                  >
                    <CheckCircle2 className="size-4" />
                    Aprovar orçamento
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar aprovação</AlertDialogTitle>
                    <AlertDialogDescription>
                      Ao confirmar, você autoriza a execução dos serviços descritos neste
                      orçamento no valor de {money(q.totals.final_value)}.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => approveMutation.mutate()}>
                      Confirmar aprovação
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Recusar */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="flex-1" disabled={rejectMutation.isPending}>
                    <XCircle className="size-4" />
                    Recusar orçamento
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Recusar orçamento</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se desejar, informe o motivo da recusa (opcional).
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <Textarea
                    rows={3}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Motivo (opcional)"
                  />
                  <AlertDialogFooter>
                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => rejectMutation.mutate()}>
                      Confirmar recusa
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </section>
        )}

        <p className="pb-4 text-center text-xs text-muted-foreground">
          DriverOps · Este link é pessoal e não exige login.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function StatusBanner({ quote }: { quote: PublicQuote }) {
  if (quote.status === "approved") {
    return (
      <Banner
        tone="success"
        icon={<CheckCircle2 className="size-5" />}
        text={`Orçamento aprovado${quote.client_name ? ` por ${quote.client_name}` : ""}. Obrigado!`}
      />
    );
  }
  if (quote.status === "rejected") {
    return (
      <Banner
        tone="error"
        icon={<XCircle className="size-5" />}
        text={`Orçamento recusado.${quote.rejection_reason ? ` Motivo: ${quote.rejection_reason}` : ""}`}
      />
    );
  }
  if (quote.status === "expired") {
    return (
      <Banner
        tone="warn"
        icon={<AlertTriangle className="size-5" />}
        text="Este orçamento está expirado. Entre em contato com a oficina para uma nova proposta."
      />
    );
  }
  if (quote.status === "canceled") {
    return <Banner tone="warn" icon={<AlertTriangle className="size-5" />} text="Este orçamento foi cancelado." />;
  }
  return null;
}

function Banner({
  tone,
  icon,
  text,
}: {
  tone: "success" | "error" | "warn";
  icon: React.ReactNode;
  text: string;
}) {
  const toneClass = {
    success: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    error: "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
    warn: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  }[tone];
  return (
    <div className={`flex items-center gap-2 rounded-xl border p-4 text-sm font-medium ${toneClass}`}>
      {icon}
      {text}
    </div>
  );
}

function CenteredMessage({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-muted/30 p-6 text-center">
      {icon}
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
