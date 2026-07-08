import { onlyDigits } from "@/lib/masks";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export function waLink(whatsapp: string, message?: string): string {
  const base = buildWhatsAppUrl(whatsapp);
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function telHref(phone: string): string {
  return `tel:+55${onlyDigits(phone)}`;
}

export function mailHref(email: string): string {
  return `mailto:${email}`;
}

export function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export const SCHEDULE_MESSAGE =
  "Olá! Gostaria de agendar um atendimento para o meu veículo.";
export const QUOTE_MESSAGE =
  "Olá! Gostaria de solicitar um orçamento para o meu veículo.";
