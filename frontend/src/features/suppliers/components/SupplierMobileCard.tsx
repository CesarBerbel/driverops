import { Building2, Mail, MapPin, MessageCircle, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDocument, formatPhone } from "@/lib/masks";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

import { SUPPLIER_TYPE_OPTIONS } from "../constants";
import type { Supplier } from "../types";

const SUPPLIER_TYPE_LABELS = Object.fromEntries(
  SUPPLIER_TYPE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<Supplier["supplier_type"], string>;

// Card mobile do fornecedor: nome/razão social em destaque, contato e
// localização resumidos, e as ações rápidas de editar e falar no WhatsApp.
export function SupplierMobileCard({
  supplier,
  onEdit,
}: {
  supplier: Supplier;
  onEdit?: (id: number) => void;
}) {
  const phone = supplier.whatsapp || supplier.phone;
  const cityUf = [supplier.city, supplier.state].filter(Boolean).join("/");

  return (
    <Card>
      <CardContent className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug">{supplier.name}</p>
            {supplier.trade_name && (
              <p className="text-xs text-muted-foreground">{supplier.trade_name}</p>
            )}
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
            <Building2 className="size-3" />
            {SUPPLIER_TYPE_LABELS[supplier.supplier_type]}
          </span>
        </div>

        {supplier.document && (
          <p className="text-xs text-muted-foreground">
            {formatDocument(supplier.document, supplier.supplier_type)}
          </p>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {phone && <span>{formatPhone(phone)}</span>}
          {supplier.email && (
            <span className="inline-flex items-center gap-1">
              <Mail className="size-3" />
              {supplier.email}
            </span>
          )}
          {cityUf && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {cityUf}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 pt-1">
          <Button
            size="sm"
            className="flex-1"
            onClick={() => onEdit?.(supplier.id)}
          >
            <Pencil className="size-4" />
            Editar
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
