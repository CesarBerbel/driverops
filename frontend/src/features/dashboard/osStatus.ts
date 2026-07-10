import { IN_PROGRESS_STATUSES, OPEN_STATUSES } from "@/features/orders/constants";
import type { OrderStatus, WorkOrder } from "@/features/orders/types";

export type OSColumn = "open" | "in_progress" | null;

export function statusColumn(status: OrderStatus): OSColumn {
  if (OPEN_STATUSES.includes(status)) return "open";
  if (IN_PROGRESS_STATUSES.includes(status)) return "in_progress";
  return null; // finished / canceled -- not on the operational board
}

// Tailwind classes per status, for the colored status pill (light/dark aware).
export function statusPillClass(status: OrderStatus): string {
  const map: Record<OrderStatus, string> = {
    open: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    diagnosing: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    awaiting_approval: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
    approved: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
    in_progress: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
    awaiting_parts: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
    testing: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
    ready: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    finished: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
    canceled: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    rejected: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  };
  return map[status];
}

// yyyy-mm-dd -> dd/mm/aaaa (no timezone math -- purely reorders the parts).
export function formatBrDate(iso: string | null): string {
  if (!iso) return "—";
  const parts = iso.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : iso;
}

// An OS is overdue when its expected delivery date is in the past and it hasn't
// been finished/canceled.
export function isOverdue(order: WorkOrder): boolean {
  if (!order.expected_delivery) return false;
  if (order.status === "finished" || order.status === "canceled") return false;
  const today = new Date();
  const todayIso = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
  return order.expected_delivery < todayIso;
}
