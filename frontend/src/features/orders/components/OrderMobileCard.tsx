import { CalendarClock, MessageCircle, User } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrencyBRL, formatPhone } from "@/lib/masks";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

import { formatOrderNumber } from "../lib/orderMapping";
import type { PaymentStatus, WorkOrder } from "../types";

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  open: "Em aberto",
  partial: "Parcial",
  paid: "Pago",
};

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
}

// Card mobile da OS: centro operacional do sistema, completo mas objetivo. O
// "orçamento" pertence à OS (acessado dentro dela em "Ver OS"), então não há
// atalho/menu separado de orçamento aqui.
export function OrderMobileCard({ order }: { order: WorkOrder }) {
  const phone = order.customer_whatsapp || order.customer_phone;
  const terminal = order.status === "canceled" || order.status === "rejected";

  return (
    <Card>
      <CardContent className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <Link
            to={`/orders/${order.id}`}
            className="text-sm font-semibold text-primary hover:underline"
          >
            {formatOrderNumber(order.number)}
          </Link>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
              terminal ? "bg-destructive/10 text-destructive" : "bg-muted",
            )}
          >
            {order.status_display}
          </span>
        </div>

        <p className="text-sm leading-snug">
          <span className="font-medium">{order.customer_name}</span>
          {(order.vehicle_description || order.vehicle_plate) && (
            <span className="text-muted-foreground">
              {" · "}
              {order.vehicle_description || order.vehicle_plate}
              {order.vehicle_description && order.vehicle_plate
                ? ` (${order.vehicle_plate})`
                : ""}
            </span>
          )}
        </p>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="size-3" />
            Previsão: {fmtDate(order.expected_delivery)}
          </span>
          <span>
            {formatCurrencyBRL(Number(order.final_value))} · {PAYMENT_LABEL[order.payment_status]}
          </span>
          {order.assigned_technician_name && (
            <span className="inline-flex items-center gap-1">
              <User className="size-3" />
              {order.assigned_technician_name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 pt-1">
          <Button asChild size="sm" className="flex-1">
            <Link to={`/orders/${order.id}`}>Ver OS</Link>
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
