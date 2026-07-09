import type { LeadStatus } from "./types";

export const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: "new", label: "Novo" },
  { value: "in_analysis", label: "Em análise" },
  { value: "contacted", label: "Cliente contatado" },
  { value: "awaiting_return", label: "Aguardando retorno" },
  { value: "converted_customer", label: "Convertido em cliente" },
  { value: "converted_appointment", label: "Convertido em agendamento" },
  { value: "converted_os", label: "Convertido em OS" },
  { value: "converted_quote", label: "Convertido em orçamento" },
  { value: "duplicate", label: "Duplicado" },
  { value: "no_success", label: "Sem sucesso" },
  { value: "canceled", label: "Cancelado" },
];

export const REQUEST_TYPES: { value: string; label: string }[] = [
  { value: "diagnostic", label: "Diagnóstico" },
  { value: "revision", label: "Revisão" },
  { value: "quote", label: "Orçamento" },
  { value: "preventive", label: "Manutenção preventiva" },
  { value: "mechanical", label: "Problema mecânico" },
  { value: "electrical", label: "Problema elétrico" },
  { value: "brakes", label: "Freios" },
  { value: "suspension", label: "Suspensão" },
  { value: "ac", label: "Ar-condicionado" },
  { value: "other", label: "Outro" },
];

// Estados "abertos" (aparecem no inbox por padrão / contam no badge).
export const OPEN_STATUSES: LeadStatus[] = [
  "new",
  "in_analysis",
  "contacted",
  "awaiting_return",
];

export function timeSince(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}
