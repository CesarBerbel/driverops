import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertCircle, ChevronRight, Inbox } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/shared/Pagination";
import { ResponsiveDataView } from "@/components/shared/ResponsiveDataView";
import { formatPhone } from "@/lib/masks";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { formatPlateForDisplay } from "@/features/vehicles/plate";

import { listLeadsPage } from "../api";
import { LeadIndicatorBadges, LeadMobileCard } from "../components/LeadMobileCard";
import { REQUEST_TYPES, STATUS_OPTIONS, timeSince } from "../constants";

export function LeadInboxPage() {
  const [status, setStatus] = useState<string>("open");
  const [requestType, setRequestType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  // Volta para a 1ª página sempre que um filtro muda (senão poderíamos ficar
  // numa página que não existe mais no resultado filtrado).
  useEffect(() => {
    setPage(1);
  }, [status, requestType, search]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["leads", page, { status, requestType, search }],
    queryFn: () =>
      // O backend entende `status=open` como os pedidos não terminais; "all"
      // não filtra por status; qualquer outro valor filtra pelo status exato.
      listLeadsPage(page, {
        status: status !== "all" ? status : undefined,
        request_type: requestType !== "all" ? requestType : undefined,
        q: search.trim() || undefined,
      }),
    // Mantém a página anterior visível enquanto a próxima carrega (sem "piscar").
    placeholderData: keepPreviousData,
  });

  const leads = data?.results ?? [];
  const isEmpty = (data?.count ?? 0) === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Inbox className="size-6 text-primary" />
          Pedidos do Site
        </h1>
        <p className="text-muted-foreground">
          Solicitações de contato enviadas pelos clientes no site da oficina.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          placeholder="Buscar por nome, telefone, placa ou e-mail…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Buscar pedidos"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Filtrar por status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Em aberto</SelectItem>
            <SelectItem value="all">Todos os status</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={requestType} onValueChange={setRequestType}>
          <SelectTrigger aria-label="Filtrar por tipo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {REQUEST_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertCircle className="size-8 text-destructive" />
            <p className="text-sm text-muted-foreground">Não foi possível carregar os pedidos.</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : isEmpty ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <Inbox className="size-8" />
            Nenhum pedido com os filtros atuais.
          </CardContent>
        </Card>
      ) : (
        <ResponsiveDataView
          items={leads}
          getKey={(lead) => lead.id}
          renderCard={(lead) => <LeadMobileCard lead={lead} />}
          table={
            <div className="space-y-2">
              {leads.map((lead) => (
                <Link key={lead.id} to={`/leads/${lead.id}`}>
                  <Card className="transition-colors hover:bg-accent/50">
                    <CardContent className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{lead.name}</span>
                          {lead.status === "new" && <Badge>Novo</Badge>}
                          <span className="text-xs text-muted-foreground">
                            {timeSince(lead.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatPhone(lead.phone)}
                          {lead.vehicle_plate && ` · ${formatPlateForDisplay(lead.vehicle_plate)}`}
                          {lead.vehicle_brand && ` ${lead.vehicle_brand} ${lead.vehicle_model}`}
                          {" · "}
                          {lead.request_type_display}
                        </p>
                        <LeadIndicatorBadges lead={lead} />
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">{lead.status_display}</p>
                          {lead.assigned_to_name && (
                            <p className="text-xs text-muted-foreground">{lead.assigned_to_name}</p>
                          )}
                        </div>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          }
        />
      )}

      {!isLoading && !isError && !isEmpty && (
        <Pagination
          page={page}
          pageSize={DEFAULT_PAGE_SIZE}
          count={data?.count ?? 0}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
