import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CalendarClock,
  Car,
  Clock,
  Download,
  FileText,
  MessageCircle,
  Phone,
  Send,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrencyBRL } from "@/lib/masks";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

import { BackToSite } from "../components/BackToSite";
import { getVehiclePortal, portalOrderPdfUrl, sendPortalMessage } from "../api";
import type {
  PortalMessageKind,
  PortalOrderDetail,
  PortalTimelineEntry,
  VehiclePortal,
} from "../types";

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
}

function errorStatus(error: unknown): number | undefined {
  const resp = (error as { response?: { status?: number } })?.response;
  return resp?.status;
}

const MESSAGE_KINDS: { value: PortalMessageKind; label: string }[] = [
  { value: "quote", label: "Dúvida sobre orçamento" },
  { value: "progress", label: "Dúvida sobre andamento" },
  { value: "callback", label: "Quero que me liguem" },
  { value: "pickup", label: "Combinar retirada" },
  { value: "other", label: "Outro" },
];

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh bg-muted/30 p-4">
      <div className="mx-auto w-full max-w-2xl space-y-4">{children}</div>
    </div>
  );
}

function CenteredMessage({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <Shell>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          {icon}
          <h1 className="text-lg font-semibold">{title}</h1>
          <div className="text-sm text-muted-foreground">{children}</div>
        </CardContent>
      </Card>
    </Shell>
  );
}

function Timeline({ entries }: { entries: PortalTimelineEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <ol className="space-y-3">
      {entries.map((entry, index) => {
        const current = index === entries.length - 1;
        return (
          <li key={`${entry.status}-${index}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`mt-1 size-2.5 shrink-0 rounded-full ${
                  current ? "bg-primary ring-2 ring-primary/30" : "bg-muted-foreground/40"
                }`}
              />
              {!current && <span className="mt-1 w-px flex-1 bg-border" />}
            </div>
            <div className="pb-1">
              <p
                className={`text-sm ${current ? "font-semibold text-foreground" : "text-muted-foreground"}`}
              >
                {entry.status_display}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(entry.at).toLocaleString("pt-BR")}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function CurrentOrder({
  order,
  token,
}: {
  order: PortalOrderDetail;
  token: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">OS {String(order.number).padStart(4, "0")}</CardTitle>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {order.status_display}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-4" /> Aberta em {fmtDate(order.opened_at)}
          </span>
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="size-4" /> Previsão: {fmtDate(order.expected_delivery)}
          </span>
        </div>

        {order.customer_report && (
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Relato</p>
            <p className="whitespace-pre-line text-sm">{order.customer_report}</p>
          </div>
        )}
        {order.diagnosis && (
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Diagnóstico</p>
            <p className="whitespace-pre-line text-sm">{order.diagnosis}</p>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Andamento</p>
          <Timeline entries={order.timeline} />
        </div>

        {order.quote && (
          <div className="rounded-md border bg-muted/40 p-3">
            <p className="text-sm font-medium">Orçamento</p>
            <p className="text-sm text-muted-foreground">{order.quote.status_display}</p>
            <Button asChild size="sm" className="mt-2">
              <a href={order.quote.approval_url} target="_blank" rel="noopener noreferrer">
                Ver / aprovar orçamento
              </a>
            </Button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {order.has_pdf && (
            <Button asChild variant="outline" size="sm">
              <a href={portalOrderPdfUrl(token, order.id)} target="_blank" rel="noopener noreferrer">
                <FileText className="size-4" /> PDF da OS
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MessageForm({ token }: { token: string }) {
  const [kind, setKind] = useState<PortalMessageKind>("progress");
  const [message, setMessage] = useState("");
  const mutation = useMutation({
    mutationFn: () => sendPortalMessage(token, { kind, message }),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (message.trim()) mutation.mutate();
  }

  if (mutation.isSuccess) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          {mutation.data?.detail ?? "Mensagem enviada. A oficina entrará em contato."}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Falar com a oficina</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Assunto</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as PortalMessageKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESSAGE_KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="msg">Mensagem</Label>
            <Textarea
              id="msg"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escreva sua mensagem para a oficina..."
            />
          </div>
          <Button type="submit" disabled={mutation.isPending || !message.trim()}>
            <Send className="size-4" />
            {mutation.isPending ? "Enviando..." : "Enviar mensagem"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function VehiclePortalPage() {
  const { token = "" } = useParams();
  const { data, isLoading, isError, error } = useQuery<VehiclePortal>({
    queryKey: ["vehicle-portal", token],
    queryFn: () => getVehiclePortal(token),
    retry: false,
  });

  if (isLoading) {
    return (
      <Shell>
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </Shell>
    );
  }

  if (isError) {
    const status = errorStatus(error);
    if (status === 410) {
      return (
        <CenteredMessage icon={<Clock className="size-8 text-muted-foreground" />} title="Este link expirou">
          <p>Por segurança, solicite um novo acesso para consultar as informações do veículo.</p>
          <div className="mt-3 flex flex-col items-center gap-2">
            <Button asChild>
              <Link to="/veiculo">Solicitar novo link</Link>
            </Button>
            <BackToSite />
          </div>
        </CenteredMessage>
      );
    }
    return (
      <CenteredMessage icon={<AlertCircle className="size-8 text-destructive" />} title="Não foi possível acessar">
        <p>
          Não foi possível acessar a área do veículo com este link. Solicite um novo
          acesso ou entre em contato com a oficina.
        </p>
        <div className="mt-3 flex flex-col items-center gap-2">
          <Button asChild variant="outline">
            <Link to="/veiculo">Solicitar novo link</Link>
          </Button>
          <BackToSite />
        </div>
      </CenteredMessage>
    );
  }

  if (!data) return null;

  const { vehicle, workshop, options, current_order: current, history } = data;
  const whatsapp = workshop.whatsapp;

  return (
    <Shell>
      {/* Barra da área segura: identifica a oficina e permite voltar ao site. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {workshop.logo ? (
            <img
              src={workshop.logo}
              alt={workshop.name}
              className="h-8 w-auto max-w-[140px] object-contain"
            />
          ) : (
            <span className="text-sm font-semibold">{workshop.name}</span>
          )}
        </div>
        <BackToSite label="Voltar para o site" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="size-5 text-primary" />
            Acompanhamento do veículo
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Veja o andamento da ordem de serviço (OS) atual e o histórico de
            atendimentos deste veículo.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <span className="rounded-md border px-2 py-0.5 font-bold tracking-wide">
              {vehicle.plate}
            </span>
            <span>{[vehicle.brand, vehicle.model].filter(Boolean).join(" ")}</span>
            {vehicle.year && <span className="text-muted-foreground">Ano {vehicle.year}</span>}
            {vehicle.color && <span className="text-muted-foreground">{vehicle.color}</span>}
            {vehicle.mileage != null && (
              <span className="text-muted-foreground">
                {vehicle.mileage.toLocaleString("pt-BR")} km
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {current ? (
        <CurrentOrder order={current} token={token} />
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Não há OS em andamento para este veículo no momento.
          </CardContent>
        </Card>
      )}

      {options.show_history && history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico de serviços</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.map((os) => (
              <div
                key={os.id}
                className="flex items-center justify-between gap-2 rounded-md border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">OS {String(os.number).padStart(4, "0")}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(os.opened_at)} · {os.status_display}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">
                    {formatCurrencyBRL(Number(os.final_value))}
                  </span>
                  {options.allow_pdf_download && (
                    <a
                      href={portalOrderPdfUrl(token, os.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Baixar PDF da OS ${os.number}`}
                      className="text-primary"
                    >
                      <Download className="size-4" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contato</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {whatsapp && (
            <Button asChild variant="outline">
              <a href={buildWhatsAppUrl(whatsapp)} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-4" /> WhatsApp
              </a>
            </Button>
          )}
          {workshop.phone && (
            <Button asChild variant="outline">
              <a href={`tel:${workshop.phone}`}>
                <Phone className="size-4" /> Ligar
              </a>
            </Button>
          )}
        </CardContent>
      </Card>

      {options.allow_messages && <MessageForm token={token} />}

      <div className="pb-2 pt-1 text-center">
        <BackToSite label="Voltar para o site da oficina" />
      </div>
    </Shell>
  );
}
