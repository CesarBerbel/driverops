import { MessageCircle, Phone } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatPhone, onlyDigits } from "@/lib/masks";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

interface ContactLinkProps {
  // Digits-only values as stored by the backend. WhatsApp is preferred; a
  // phone-only contact falls back to a tel: link.
  whatsapp?: string | null;
  phone?: string | null;
  emptyText?: string;
  className?: string;
  emptyClassName?: string;
}

// Shared clickable phone/WhatsApp used in customer/OS surfaces so the behavior
// (wa.me for WhatsApp, tel: for phone, Brazilian mask) stays consistent.
export function ContactLink({
  whatsapp,
  phone,
  emptyText = "Telefone não informado",
  className,
  emptyClassName,
}: ContactLinkProps) {
  const linkClasses = cn(
    "inline-flex w-fit max-w-full items-center gap-1 truncate hover:underline",
    className,
  );

  if (whatsapp) {
    return (
      <a
        href={buildWhatsAppUrl(whatsapp)}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(linkClasses, "text-success")}
        onClick={(event) => event.stopPropagation()}
      >
        <MessageCircle className="size-3.5 shrink-0" />
        <span className="truncate">{formatPhone(whatsapp)}</span>
      </a>
    );
  }

  if (phone) {
    return (
      <a
        href={`tel:+55${onlyDigits(phone)}`}
        className={linkClasses}
        onClick={(event) => event.stopPropagation()}
      >
        <Phone className="size-3.5 shrink-0" />
        <span className="truncate">{formatPhone(phone)}</span>
      </a>
    );
  }

  return (
    <span className={cn("text-xs text-muted-foreground", emptyClassName)}>{emptyText}</span>
  );
}
