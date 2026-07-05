import type { QuoteStatus } from "./types";

// Classes Tailwind por status (light/dark aware), no mesmo espírito das pills da OS.
export function quoteStatusClass(status: QuoteStatus): string {
  const map: Record<QuoteStatus, string> = {
    draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    sent: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
    viewed: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
    partially_approved:
      "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
    approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    rejected: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    expired: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    canceled: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  };
  return map[status];
}

// ISO -> "dd/mm/aaaa HH:mm" (horário local). "" quando nulo.
export function formatDateTimeBr(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(date.getDate())}/${p(date.getMonth() + 1)}/${date.getFullYear()} ${p(
    date.getHours(),
  )}:${p(date.getMinutes())}`;
}
