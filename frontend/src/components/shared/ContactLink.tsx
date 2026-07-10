import { MessageCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatPhone } from "@/lib/masks";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

interface ContactLinkProps {
  // Digits-only values as stored by the backend. O número do cliente é tratado
  // como contato de WhatsApp: usa o WhatsApp quando houver, senão o telefone.
  whatsapp?: string | null;
  phone?: string | null;
  emptyText?: string;
  className?: string;
  emptyClassName?: string;
}

// Shared clickable contact used in customer/OS surfaces. O telefone do cliente é
// considerado WhatsApp, então o número (whatsapp || phone) sempre abre a conversa
// no WhatsApp (wa.me, com máscara brasileira) para enviar mensagem.
export function ContactLink({
  whatsapp,
  phone,
  emptyText = "Telefone não informado",
  className,
  emptyClassName,
}: ContactLinkProps) {
  const number = whatsapp || phone;

  if (number) {
    return (
      <a
        href={buildWhatsAppUrl(number)}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex w-fit max-w-full items-center gap-1 truncate text-success hover:underline",
          className,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <MessageCircle className="size-3.5 shrink-0" />
        <span className="truncate">{formatPhone(number)}</span>
      </a>
    );
  }

  return (
    <span className={cn("text-xs text-muted-foreground", emptyClassName)}>{emptyText}</span>
  );
}
