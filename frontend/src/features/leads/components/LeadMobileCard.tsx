import {
  AlertTriangle,
  CalendarClock,
  Car,
  Mail,
  MessageCircle,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatPhone } from "@/lib/masks";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { formatPlateForDisplay } from "@/features/vehicles/plate";

import { timeSince } from "../constants";
import type { LeadListItem } from "../types";

// Badges dos indicadores do pedido (cliente/veículo/OS). Reaproveitado tanto
// na lista desktop quanto no card mobile para manter a leitura consistente.
export function LeadIndicatorBadges({ lead }: { lead: LeadListItem }) {
  const ind = lead.indicators;
  return (
    <div className="flex flex-wrap gap-1">
      {ind.customer_existing ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600">
          <UserCheck className="size-3" /> Cliente existente
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-600">
          <UserPlus className="size-3" /> Cliente novo
        </span>
      )}
      {ind.vehicle_existing && (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
          <Car className="size-3" /> Veículo existente
        </span>
      )}
      {ind.vehicle_divergent && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600">
          <AlertTriangle className="size-3" /> Veículo divergente
        </span>
      )}
      {ind.has_open_os && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600">
          <AlertTriangle className="size-3" /> OS aberta
        </span>
      )}
    </div>
  );
}

// Card mobile do pedido do site (lead): resume o solicitante, o contato, o tipo
// de pedido e os indicadores, com atalho direto para o detalhe e para o
// WhatsApp do solicitante.
export function LeadMobileCard({ lead }: { lead: LeadListItem }) {
  const vehicle = [lead.vehicle_brand, lead.vehicle_model]
    .filter(Boolean)
    .join(" ");

  return (
    <Card>
      <CardContent className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <Link
            to={`/leads/${lead.id}`}
            className="text-sm font-semibold text-primary hover:underline"
          >
            {lead.name}
          </Link>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
              lead.status === "new" ? "bg-primary/10 text-primary" : "bg-muted",
            )}
          >
            {lead.status_display}
          </span>
        </div>

        <p className="text-sm leading-snug text-muted-foreground">
          <span className="font-medium text-foreground">{lead.request_type_display}</span>
          {(lead.vehicle_plate || vehicle) && (
            <span>
              {" · "}
              {lead.vehicle_plate ? formatPlateForDisplay(lead.vehicle_plate) : ""}
              {lead.vehicle_plate && vehicle ? ` ${vehicle}` : vehicle}
            </span>
          )}
        </p>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {lead.phone && (
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="size-3" />
              {formatPhone(lead.phone)}
            </span>
          )}
          {lead.email && (
            <span className="inline-flex items-center gap-1">
              <Mail className="size-3" />
              {lead.email}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="size-3" />
            {timeSince(lead.created_at)}
          </span>
          {lead.assigned_to_name && <span>{lead.assigned_to_name}</span>}
        </div>

        <LeadIndicatorBadges lead={lead} />

        <div className="flex items-center gap-1.5 pt-1">
          <Button asChild size="sm" className="flex-1">
            <Link to={`/leads/${lead.id}`}>Ver pedido</Link>
          </Button>
          {lead.phone && (
            <Button asChild size="sm" variant="outline" title="WhatsApp" aria-label="WhatsApp">
              <a
                href={buildWhatsAppUrl(lead.phone)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="size-4" />
                <span className="sr-only">{formatPhone(lead.phone)}</span>
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
