import type { QuoteItem } from "../types";

/** Soma dos subtotais dos itens aprovados (para a prévia do valor da decisão). */
export function approvedTotal(items: QuoteItem[], approvedIds: number[]): number {
  const set = new Set(approvedIds);
  return items
    .filter((item) => set.has(item.id))
    .reduce((sum, item) => sum + Number(item.subtotal), 0);
}
