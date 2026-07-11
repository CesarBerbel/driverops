import { Car, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatPhone } from "@/lib/masks";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

import type { Customer } from "../types";

// Card mobile do cliente: espelha a estética do OrderMobileCard (mesmo
// espaçamento/estrutura). Atalho principal leva ao 360° do cliente; o
// botão de WhatsApp aparece só quando há telefone/whatsapp.
export function CustomerMobileCard({ customer }: { customer: Customer }) {
  const phone = customer.whatsapp || customer.phone;
  const location = customer.city
    ? `${customer.city}${customer.state ? `/${customer.state}` : ""}`
    : "";

  return (
    <Card>
      <CardContent className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <Link
            to={`/customers/${customer.id}/360`}
            className="text-sm font-semibold text-primary hover:underline"
          >
            {customer.name}
          </Link>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {phone && (
            <span className="inline-flex items-center gap-1">
              <Phone className="size-3" />
              {formatPhone(phone)}
            </span>
          )}
          {customer.email && (
            <span className="inline-flex items-center gap-1">
              <Mail className="size-3" />
              {customer.email}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Car className="size-3" />
            {customer.vehicle_count} veículo(s)
          </span>
          {location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {location}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 pt-1">
          <Button asChild size="sm" className="flex-1">
            <Link to={`/customers/${customer.id}/360`}>Ver 360°</Link>
          </Button>
          {phone && (
            <Button asChild size="sm" variant="outline" title="WhatsApp" aria-label="WhatsApp">
              <a
                href={buildWhatsAppUrl(phone)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="size-4" />
                <span className="sr-only">{formatPhone(phone)}</span>
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
