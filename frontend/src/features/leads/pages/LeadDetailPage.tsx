import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Car,
  CheckCircle2,
  ClipboardList,
  FileText,
  Mail,
  MessageCircle,
  Phone,
  UserPlus,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissionCheck } from "@/features/auth/usePermission";
import { formatPlateForDisplay } from "@/features/vehicles/plate";
import { extractErrorMessage } from "@/lib/api-client";
import { formatPhone, onlyDigits } from "@/lib/masks";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

import { getLead, leadActions } from "../api";
import { STATUS_OPTIONS, timeSince } from "../constants";
import type { LeadDetail } from "../types";

function errorCode(err: unknown): string | undefined {
  const anyErr = err as { response?: { data?: { code?: string } } };
  return anyErr?.response?.data?.code;
}

export function LeadDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const can = usePermissionCheck();
  const canAttend = can("leads.attend");
  const canConvert = can("leads.convert");

  const [note, setNote] = useState("");
  const [confirmOpenOs, setConfirmOpenOs] = useState(false);

  const { data: lead, isLoading, isError } = useQuery({
    queryKey: ["lead", id],
    queryFn: () => getLead(id),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["lead", id] });
    queryClient.invalidateQueries({ queryKey: ["leads"] });
    queryClient.invalidateQueries({ queryKey: ["leads-pending-count"] });
  }

  const action = useMutation({
    mutationFn: (fn: () => Promise<LeadDetail>) => fn(),
    onSuccess: () => {
      invalidate();
      toast.success("Pedido atualizado.");
    },
    onError: (err) => toast.error(extractErrorMessage(err, "Não foi possível executar a ação.")),
  });

  const convertOs = useMutation({
    mutationFn: (confirm: boolean) => leadActions.convertOs(id, confirm),
    onSuccess: () => {
      invalidate();
      setConfirmOpenOs(false);
      toast.success("OS gerada a partir do pedido.");
    },
    onError: (err) => {
      const code = errorCode(err);
      if (code === "open_os") {
        setConfirmOpenOs(true);
        return;
      }
      toast.error(extractErrorMessage(err, "Não foi possível gerar a OS."));
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (isError || !lead) {
    return (
      <div className="space-y-4">
        <Link to="/leads" className="text-sm text-muted-foreground hover:text-foreground">
          ← Pedidos do Site
        </Link>
        <p className="text-sm text-muted-foreground">Pedido não encontrado.</p>
      </div>
    );
  }

  const a = lead.analysis;
  const suggestedCustomer = a.customer_match.customer;
  const matchedVehicle = a.vehicle_match.vehicle;

  return (
    <div className="space-y-6">
      <Link to="/leads" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Pedidos do Site
      </Link>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{lead.name}</h1>
          <p className="text-muted-foreground">
            {lead.request_type_display} · {timeSince(lead.created_at)} · Origem: site
          </p>
        </div>
        <Badge>{lead.status_display}</Badge>
      </div>

      {/* Alertas */}
      {a.vehicle_belongs_to_other_customer && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <span>
            Atenção: este veículo já está cadastrado para outro cliente
            {a.vehicle_match.owner ? ` (${a.vehicle_match.owner.name})` : ""}. Confirme se houve
            troca de proprietário, erro de digitação ou pedido de terceiro autorizado antes de
            converter.
          </span>
        </div>
      )}
      {lead.indicators.has_open_os && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <span>Este veículo já possui uma OS aberta. Verifique antes de criar uma nova.</span>
        </div>
      )}

      {/* Ações rápidas de contato */}
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <a href={`tel:+55${onlyDigits(lead.phone)}`}>
            <Phone className="size-4" /> Ligar
          </a>
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href={buildWhatsAppUrl(lead.phone)} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="size-4" /> WhatsApp
          </a>
        </Button>
        {lead.email && (
          <Button asChild variant="outline" size="sm">
            <a href={`mailto:${lead.email}`}>
              <Mail className="size-4" /> E-mail
            </a>
          </Button>
        )}
        {canAttend && (
          <Button
            size="sm"
            disabled={action.isPending}
            onClick={() => action.mutate(() => leadActions.contact(id, "telefone"))}
          >
            <CheckCircle2 className="size-4" /> Marcar como contatado
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Dados do cliente informados */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cliente informado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p><span className="text-muted-foreground">Nome:</span> {lead.name}</p>
            <p><span className="text-muted-foreground">Telefone:</span> {formatPhone(lead.phone)}</p>
            {lead.email && <p><span className="text-muted-foreground">E-mail:</span> {lead.email}</p>}
            <p><span className="text-muted-foreground">Melhor período:</span> {lead.best_period_display}</p>

            <div className="mt-2 rounded-md border p-2">
              {a.customer_match.confidence === "high" && suggestedCustomer ? (
                <p className="text-sm text-emerald-700">
                  Cliente encontrado: <strong>{suggestedCustomer.name}</strong>.
                </p>
              ) : a.customer_match.confidence === "possible" && suggestedCustomer ? (
                <p className="text-sm text-amber-700">
                  Possível cliente: {suggestedCustomer.name}. Revise antes de criar novo cadastro.
                </p>
              ) : a.customer_match.confidence === "conflict" ? (
                <p className="text-sm text-amber-700">Dados conflitantes — vários clientes possíveis.</p>
              ) : (
                <p className="text-sm text-muted-foreground">Cliente novo (sem correspondência).</p>
              )}
              {canConvert && !lead.linked_customer && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {suggestedCustomer && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={action.isPending}
                      onClick={() =>
                        action.mutate(() => leadActions.linkCustomer(id, suggestedCustomer.id))
                      }
                    >
                      Vincular ao existente
                    </Button>
                  )}
                  <Button
                    size="sm"
                    disabled={action.isPending}
                    onClick={() => action.mutate(() => leadActions.createCustomer(id))}
                  >
                    <UserPlus className="size-4" /> Criar cliente
                  </Button>
                </div>
              )}
              {lead.linked_customer && (
                <p className="mt-2 text-sm">
                  <CheckCircle2 className="mr-1 inline size-4 text-emerald-600" />
                  Vinculado: {lead.linked_customer.name}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Dados do veículo informados */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Veículo informado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Placa:</span>{" "}
              {lead.vehicle_plate ? formatPlateForDisplay(lead.vehicle_plate) : "—"}
            </p>
            <p><span className="text-muted-foreground">Marca/Modelo:</span> {lead.vehicle_brand} {lead.vehicle_model}</p>
            {lead.vehicle_year && <p><span className="text-muted-foreground">Ano:</span> {lead.vehicle_year}</p>}

            <div className="mt-2 rounded-md border p-2">
              {a.vehicle_match.found ? (
                <p className="text-sm">
                  Veículo encontrado
                  {a.vehicle_match.owner ? ` — dono atual: ${a.vehicle_match.owner.name}` : ""}.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {lead.vehicle_plate ? "Veículo não encontrado (novo)." : "Sem veículo informado."}
                </p>
              )}
              {canConvert && !lead.linked_vehicle && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {matchedVehicle && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={action.isPending}
                      onClick={() => action.mutate(() => leadActions.linkVehicle(id, matchedVehicle.id))}
                    >
                      Vincular ao existente
                    </Button>
                  )}
                  {lead.vehicle_plate && (
                    <Button
                      size="sm"
                      disabled={action.isPending || !lead.linked_customer}
                      onClick={() => action.mutate(() => leadActions.createVehicle(id))}
                    >
                      <Car className="size-4" /> Criar veículo
                    </Button>
                  )}
                </div>
              )}
              {lead.linked_vehicle && (
                <p className="mt-2 text-sm">
                  <CheckCircle2 className="mr-1 inline size-4 text-emerald-600" />
                  Vinculado: {formatPlateForDisplay(lead.linked_vehicle.license_plate)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mensagem do cliente */}
      {lead.message && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mensagem do cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{lead.message}</p>
          </CardContent>
        </Card>
      )}

      {/* Conversão e status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Atendimento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Select
              value={lead.status}
              onValueChange={(v) => canAttend && action.mutate(() => leadActions.setStatus(id, v))}
              disabled={!canAttend}
            >
              <SelectTrigger className="w-56" aria-label="Status do pedido">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {canConvert && (
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!lead.linked_customer || !lead.linked_vehicle || convertOs.isPending}
                onClick={() => convertOs.mutate(false)}
              >
                <Wrench className="size-4" /> Gerar OS
              </Button>
              <Button
                variant="outline"
                disabled={!lead.linked_customer || !lead.linked_vehicle || action.isPending}
                onClick={() => action.mutate(() => leadActions.convertQuote(id, true))}
              >
                <FileText className="size-4" /> Gerar orçamento
              </Button>
              {lead.work_order && (
                <Button asChild variant="outline">
                  <Link to={`/orders/${lead.work_order.id}`}>
                    Abrir OS #{String(lead.work_order.number).padStart(4, "0")}
                  </Link>
                </Button>
              )}
            </div>
          )}

          {canAttend && (
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={() => action.mutate(() => leadActions.markDuplicate(id))}>
                Marcar como duplicado
              </Button>
              <Button variant="ghost" size="sm" onClick={() => action.mutate(() => leadActions.cancel(id))}>
                Cancelar pedido
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Observação interna */}
      {canAttend && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registrar observação</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: cliente pediu retorno à tarde"
              aria-label="Observação interna"
            />
            <Button
              disabled={!note.trim() || action.isPending}
              onClick={() => {
                const text = note.trim();
                action.mutate(() => leadActions.note(id, text));
                setNote("");
              }}
            >
              Adicionar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="size-4 text-primary" /> Histórico do atendimento
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lead.events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem registros ainda.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {lead.events.map((ev) => (
                <li key={ev.id} className="flex flex-col border-b pb-2 last:border-0">
                  <span className="text-muted-foreground">
                    {new Date(ev.created_at).toLocaleString("pt-BR")} · {ev.actor_name ?? "Sistema"}
                  </span>
                  <span>
                    {ev.event_type_display}
                    {ev.description ? ` — ${ev.description}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpenOs} onOpenChange={setConfirmOpenOs}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Este veículo já possui uma OS aberta</AlertDialogTitle>
            <AlertDialogDescription>
              Verifique antes de criar uma nova OS. Deseja continuar mesmo assim?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={convertOs.isPending} onClick={() => convertOs.mutate(true)}>
              Criar OS mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
