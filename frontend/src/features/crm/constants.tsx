import type { Priority, TaskStatus } from "./types";

export const PRIORITY: Record<Priority, { label: string; badge: string; dot: string }> = {
  low: { label: "Baixa", badge: "border-slate-300 text-muted-foreground", dot: "bg-slate-400" },
  medium: { label: "Média", badge: "border-blue-300 text-blue-700 dark:text-blue-400", dot: "bg-blue-500" },
  high: { label: "Alta", badge: "border-amber-400 text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  urgent: { label: "Urgente", badge: "border-red-400 text-red-700 dark:text-red-400", dot: "bg-red-500" },
};

export const STATUS_FILTERS = [
  { value: "open", label: "Abertas" },
  { value: "", label: "Todas" },
  { value: "completed", label: "Concluídas" },
  { value: "ignored", label: "Ignoradas" },
  { value: "snoozed", label: "Adiadas" },
];

export const CATEGORY_OPTIONS = [
  { value: "conversation", label: "Conversa" },
  { value: "quote", label: "Orçamento" },
  { value: "order", label: "Ordem de Serviço" },
  { value: "reactivation", label: "Reativação" },
  { value: "campaign", label: "Campanha" },
  { value: "opportunity", label: "Oportunidade" },
  { value: "post_service", label: "Pós-serviço" },
];

export const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "urgent", label: "Urgente" },
  { value: "high", label: "Alta" },
  { value: "medium", label: "Média" },
  { value: "low", label: "Baixa" },
];

export const TASK_STATUS: Record<TaskStatus, { label: string; badge: string }> = {
  open: { label: "Aberta", badge: "border-blue-300 text-blue-700 dark:text-blue-400" },
  done: { label: "Concluída", badge: "border-emerald-400 text-emerald-700 dark:text-emerald-400" },
  canceled: { label: "Cancelada", badge: "border-slate-300 text-muted-foreground" },
};

export const TASK_STATUS_FILTERS = [
  { value: "open", label: "Abertas" },
  { value: "", label: "Todas" },
  { value: "done", label: "Concluídas" },
  { value: "canceled", label: "Canceladas" },
];
