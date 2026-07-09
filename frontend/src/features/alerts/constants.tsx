import {
  AlertCircle,
  AlertTriangle,
  Bell,
  ClipboardList,
  DollarSign,
  Info,
  Inbox,
  OctagonAlert,
  Package,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";

import type { NotificationItem, NotifPriority } from "./types";

export const MODULE_OPTIONS = [
  { value: "leads", label: "Site/Pedidos" },
  { value: "orders", label: "Ordem de Serviço" },
  { value: "quotes", label: "Orçamentos" },
  { value: "financial", label: "Financeiro" },
  { value: "parts", label: "Estoque" },
  { value: "system", label: "Sistema" },
  { value: "admin", label: "Administrativo" },
];

export const PRIORITY_OPTIONS: { value: NotifPriority; label: string }[] = [
  { value: "info", label: "Informativa" },
  { value: "attention", label: "Atenção" },
  { value: "important", label: "Importante" },
  { value: "urgent", label: "Urgente" },
  { value: "critical", label: "Crítica" },
];

const MODULE_ICON: Record<string, LucideIcon> = {
  leads: Inbox,
  orders: ClipboardList,
  quotes: ClipboardList,
  financial: DollarSign,
  parts: Package,
  system: Bell,
  admin: ShieldAlert,
};

export function moduleIcon(module: string): LucideIcon {
  return MODULE_ICON[module] ?? Bell;
}

interface PriorityStyle {
  icon: LucideIcon;
  label: string;
  /** classes de badge -- nunca só cor: sempre acompanha ícone + rótulo. */
  badge: string;
  dot: string;
}

export const PRIORITY_STYLE: Record<NotifPriority, PriorityStyle> = {
  info: {
    icon: Info,
    label: "Informativa",
    badge: "border-slate-300 text-slate-600 dark:text-slate-300",
    dot: "bg-slate-400",
  },
  attention: {
    icon: AlertCircle,
    label: "Atenção",
    badge: "border-amber-300 text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  important: {
    icon: Bell,
    label: "Importante",
    badge: "border-blue-300 text-blue-700 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  urgent: {
    icon: AlertTriangle,
    label: "Urgente",
    badge: "border-orange-400 text-orange-700 dark:text-orange-400",
    dot: "bg-orange-500",
  },
  critical: {
    icon: OctagonAlert,
    label: "Crítica",
    badge: "border-red-400 text-red-700 dark:text-red-400",
    dot: "bg-red-500",
  },
};

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function fullDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

/** Rótulo do grupo por data (Hoje / Ontem / dd/mm/aaaa). */
export function dateGroupLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (days <= 0) return "Hoje";
  if (days === 1) return "Ontem";
  return d.toLocaleDateString("pt-BR");
}

export function groupByDate(items: NotificationItem[]): { label: string; items: NotificationItem[] }[] {
  const groups: { label: string; items: NotificationItem[] }[] = [];
  for (const item of items) {
    const label = dateGroupLabel(item.created_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}
