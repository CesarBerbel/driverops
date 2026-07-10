import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Car,
  ClipboardList,
  FileText,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { PageLoader } from "@/components/loading";
import { ContactLink } from "@/components/shared/ContactLink";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { extractErrorMessage } from "@/lib/api-client";
import { onlyDigits } from "@/lib/masks";
import { cn } from "@/lib/utils";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

import {
  createInteraction,
  getCustomer360,
  getCustomerFinancial,
  getCustomerInteractions,
  getCustomerOrders,
  getCustomerTimeline,
} from "../api";
import { Customer360QuotesTab } from "../QuotesTab";
import type { Customer360, OrderRow, QuoteRow } from "../types";

const ALERT_STYLE: Record<string, string> = {
  info: "border-blue-300 bg-blue-500/5 text-blue-700 dark:text-blue-400",
  warning: "border-amber-300 bg-amber-500/5 text-amber-700 dark:text-amber-400",
  danger: "border-red-400 bg-red-500/5 text-red-700 dark:text-red-400",
};

type TabKey =
  | "overview"
  | "vehicles"
  | "orders"
  | "quotes"
  | "interactions"
  | "financial"
  | "timeline";

export function Customer360Page() {
  const { id: idParam } = useParams();
  const id = Number(idParam);
  const [tab, setTab] = useState<TabKey>("overview");
  // Avisos dispensados só nesta visita: o estado zera ao (re)entrar na tela do
  // cliente, então os avisos voltam a aparecer na próxima vez.
  const [dismissedAlerts, setDismissedAlerts] = useState<number[]>([]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["c360", id],
    queryFn: () => getCustomer360(id),
  });

  if (isLoading) return <PageLoader label="Carregando Cliente 360°..." />;
  if (isError || !data) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-muted-foreground">Não foi possível carregar o cliente.</p>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  const c = data.customer;
  const phone = c.whatsapp || c.phone;

  const tabs: { key: TabKey; label: string; show?: boolean }[] = [
    { key: "overview", label: "Visão geral" },
    { key: "vehicles", label: "Veículos" },
    { key: "orders", label: "Ordens de Serviço" },
    { key: "quotes", label: "Orçamentos" },
    { key: "interactions", label: "Interações" },
    { key: "financial", label: "Financeiro", show: data.can_financial },
    { key: "timeline", label: "Timeline" },
  ];

  return (
    <div className="space-y-4">
      <Link to="/customers" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Clientes
      </Link>

      {/* Cabeçalho */}
      <Card>
        <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
              {c.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-semibold">{c.name}</h1>
              <p className="text-sm text-muted-foreground">
                {c.customer_type_display}
                {!c.is_active && " · Inativo"}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
                {phone && <ContactLink whatsapp={c.whatsapp} phone={c.phone} />}
                {c.email && <span>{c.email}</span>}
                {c.address_line && <span>{c.address_line}</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {phone && (
              <>
                <Button size="sm" asChild>
                  <a href={buildWhatsAppUrl(phone)} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="size-4" /> WhatsApp
                  </a>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={`tel:${onlyDigits(phone)}`}>
                    <Phone className="size-4" /> Ligar
                  </a>
                </Button>
              </>
            )}
            {c.email && (
              <Button size="sm" variant="outline" asChild>
                <a href={`mailto:${c.email}`}>
                  <Mail className="size-4" /> E-mail
                </a>
              </Button>
            )}
            <Button size="sm" variant="outline" asChild>
              <Link to="/orders/new">
                <Plus className="size-4" /> Nova OS
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryCard label="Veículos" value={data.summary.vehicles} />
        <SummaryCard label="OS abertas" value={data.summary.open_os} />
        <SummaryCard label="OS finalizadas" value={data.summary.finished_os} />
        <SummaryCard label="Orç. pendentes" value={data.summary.pending_quotes} />
        {data.can_financial && data.summary.open_value != null && (
          <SummaryCard label="Em aberto" value={`R$ ${data.summary.open_value}`} />
        )}
        {data.summary.last_visit && (
          <SummaryCard label="Última visita" value={new Date(data.summary.last_visit).toLocaleDateString("pt-BR")} />
        )}
      </div>

      {/* Alertas (dispensáveis; reaparecem ao reentrar na tela) */}
      {data.alerts.some((_, i) => !dismissedAlerts.includes(i)) && (
        <div className="space-y-2">
          {data.alerts.map((a, i) =>
            dismissedAlerts.includes(i) ? null : (
              <div key={i} className={cn("flex items-center gap-2 rounded-md border px-3 py-2 text-sm", ALERT_STYLE[a.severity])}>
                <AlertTriangle className="size-4 shrink-0" />
                <span className="flex-1">{a.message}</span>
                {a.link && (
                  <Link to={a.link} className="font-medium underline">
                    Ver
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setDismissedAlerts((prev) => [...prev, i])}
                  className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
                  aria-label="Dispensar aviso"
                  title="Dispensar aviso"
                >
                  <X className="size-4" />
                </button>
              </div>
            ),
          )}
        </div>
      )}

      {/* Abas */}
      <div className="flex gap-1 overflow-x-auto border-b">
        {tabs.filter((t) => t.show !== false).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2 text-sm font-medium",
              tab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab data={data} onTab={setTab} />}
      {tab === "vehicles" && <VehiclesTab data={data} />}
      {tab === "orders" && <OrdersTab id={id} />}
      {tab === "quotes" && <Customer360QuotesTab id={id} customerEmail={c.email} />}
      {tab === "interactions" && <InteractionsTab id={id} canCreate={data.can_interactions} />}
      {tab === "financial" && data.can_financial && <FinancialTab id={id} />}
      {tab === "timeline" && <TimelineTab id={id} />}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function OrderLine({ o }: { o: OrderRow }) {
  return (
    <Link to={`/orders/${o.id}`} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm hover:bg-accent">
      <span className="min-w-0">
        <span className="font-medium">OS #{o.number}</span>
        <span className="text-muted-foreground"> · {o.vehicle_plate} · {o.status_display}</span>
        {o.is_overdue && <Badge variant="outline" className="ml-1 border-red-400 text-red-600">Atrasada</Badge>}
      </span>
      <span className="text-muted-foreground">R$ {o.final_value}</span>
    </Link>
  );
}

function QuoteLine({ q }: { q: QuoteRow }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
      <span>
        <span className="font-medium">Orçamento #{q.number}</span>
        <span className="text-muted-foreground"> · {q.vehicle_plate} · {q.status_display}</span>
      </span>
      {q.work_order && (
        <Link to={`/orders/${q.work_order}`} className="text-primary hover:underline">
          OS #{q.work_order_number}
        </Link>
      )}
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty?: boolean; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {empty ? <p className="text-sm text-muted-foreground">Nada por aqui.</p> : children}
      </CardContent>
    </Card>
  );
}

function OverviewTab({ data, onTab }: { data: Customer360; onTab: (t: TabKey) => void }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="OS abertas" empty={data.open_orders.length === 0}>
        {data.open_orders.map((o) => <OrderLine key={o.id} o={o} />)}
      </Section>
      <Section title="Orçamentos pendentes" empty={data.pending_quotes.length === 0}>
        {data.pending_quotes.map((q) => <QuoteLine key={q.id} q={q} />)}
      </Section>
      <Section title="Veículos" empty={data.vehicles.length === 0}>
        {data.vehicles.map((v) => (
          <div key={v.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
            <Car className="size-4 text-muted-foreground" />
            {v.license_plate} · {v.brand} {v.model} {v.model_year ?? ""}
          </div>
        ))}
      </Section>
      <Section title="Últimas interações" empty={data.recent_interactions.length === 0}>
        {data.recent_interactions.map((i) => (
          <div key={i.id} className="rounded-md border p-2 text-sm">
            <span className="font-medium">{i.interaction_type_display}</span> — {i.summary}
          </div>
        ))}
        <Button size="sm" variant="ghost" onClick={() => onTab("interactions")}>
          Ver todas
        </Button>
      </Section>
    </div>
  );
}

function VehiclesTab({ data }: { data: Customer360 }) {
  if (data.vehicles.length === 0) {
    return (
      <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">
        Nenhum veículo cadastrado para este cliente. Adicione um veículo para criar OS, orçamento ou agendamento.
      </p>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {data.vehicles.map((v) => (
        <Card key={v.id}>
          <CardContent className="flex items-center gap-3 py-4">
            <Car className="size-5 text-muted-foreground" />
            <div>
              <p className="font-medium">{v.license_plate}</p>
              <p className="text-sm text-muted-foreground">{v.brand} {v.model} {v.model_year ?? ""}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function OrdersTab({ id }: { id: number }) {
  const { data, isLoading } = useQuery({ queryKey: ["c360-orders", id], queryFn: () => getCustomerOrders(id) });
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!data || data.length === 0)
    return <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">Este cliente ainda não possui ordens de serviço.</p>;
  return <div className="space-y-2">{data.map((o) => <OrderLine key={o.id} o={o} />)}</div>;
}


const INTERACTION_TYPES = [
  { value: "call", label: "Ligação" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "E-mail" },
  { value: "in_person", label: "Atendimento presencial" },
  { value: "follow_up", label: "Follow-up" },
  { value: "note", label: "Observação interna" },
  { value: "return", label: "Retorno combinado" },
  { value: "complaint", label: "Reclamação" },
  { value: "praise", label: "Elogio" },
];

function InteractionsTab({ id, canCreate }: { id: number; canCreate: boolean }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["c360-interactions", id], queryFn: () => getCustomerInteractions(id) });
  const [type, setType] = useState("call");
  const [summary, setSummary] = useState("");

  const create = useMutation({
    mutationFn: () => createInteraction(id, { interaction_type: type, summary }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["c360-interactions", id] });
      queryClient.invalidateQueries({ queryKey: ["c360", id] });
      setSummary("");
      toast.success("Interação registrada.");
    },
    onError: (e) => toast.error(extractErrorMessage(e, "Não foi possível registrar.")),
  });

  return (
    <div className="space-y-3">
      {canCreate && (
        <Card>
          <CardContent className="flex flex-col gap-2 py-3 sm:flex-row">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {INTERACTION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              className="flex-1"
              placeholder="Resumo da interação (ex.: cliente pediu retorno amanhã)"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
            <Button disabled={!summary.trim() || create.isPending} onClick={() => create.mutate()}>
              Registrar
            </Button>
          </CardContent>
        </Card>
      )}
      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !data || data.length === 0 ? (
        <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">
          Nenhuma interação registrada. Registre ligações, mensagens ou atendimentos para manter o histórico do relacionamento.
        </p>
      ) : (
        <div className="space-y-2">
          {data.map((i) => (
            <div key={i.id} className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{i.interaction_type_display}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(i.created_at).toLocaleString("pt-BR")}
                  {i.created_by_name && ` · ${i.created_by_name}`}
                </span>
              </div>
              <p>{i.summary}</p>
              {i.next_action && <p className="text-xs text-muted-foreground">Próxima ação: {i.next_action}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FinancialTab({ id }: { id: number }) {
  const { data, isLoading } = useQuery({ queryKey: ["c360-financial", id], queryFn: () => getCustomerFinancial(id) });
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!data) return null;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Total" value={`R$ ${data.total_value}`} />
        <SummaryCard label="Pago" value={`R$ ${data.paid_value}`} />
        <SummaryCard label="Em aberto" value={`R$ ${data.open_value}`} />
      </div>
      <Section title="Pagamentos" empty={data.payments.length === 0}>
        {data.payments.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
            <span>OS #{p.order_number} · {p.method}</span>
            <span className="text-muted-foreground">R$ {p.amount} · {new Date(p.paid_at).toLocaleDateString("pt-BR")}</span>
          </div>
        ))}
      </Section>
    </div>
  );
}

const TIMELINE_ICON: Record<string, typeof ClipboardList> = {
  order: ClipboardList,
  order_finished: ClipboardList,
  quote_sent: FileText,
  quote_decided: FileText,
  payment: FileText,
  interaction: MessageCircle,
  vehicle: Car,
  customer: Plus,
};

function TimelineTab({ id }: { id: number }) {
  const { data, isLoading } = useQuery({ queryKey: ["c360-timeline", id], queryFn: () => getCustomerTimeline(id) });
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!data || data.length === 0)
    return <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">Sem eventos.</p>;
  return (
    <div className="space-y-2">
      {data.map((e, i) => {
        const Icon = TIMELINE_ICON[e.type] ?? FileText;
        const inner = (
          <div className="flex items-start gap-3 rounded-md border p-2 text-sm">
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p>{e.title}</p>
              <p className="text-xs text-muted-foreground">{new Date(e.date).toLocaleString("pt-BR")}</p>
            </div>
          </div>
        );
        return e.link ? (
          <Link key={i} to={e.link} className="block hover:opacity-80">{inner}</Link>
        ) : (
          <div key={i}>{inner}</div>
        );
      })}
    </div>
  );
}
