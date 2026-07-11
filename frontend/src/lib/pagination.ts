import type { AxiosRequestConfig } from "axios";

import { apiClient } from "./api-client";

// Envelope de paginação real do DRF (PageNumberPagination). O backend devolve
// isto quando a requisição inclui `?page` (ver apps/core/pagination.py).
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Tamanho de página padrão das listas (o backend limita em max_page_size=200).
export const DEFAULT_PAGE_SIZE = 20;

// Busca uma página real de uma listagem. Envia sempre `page` (e `page_size`)
// para o backend responder com o envelope paginado.
export async function fetchPage<T>(
  url: string,
  page: number,
  params: Record<string, unknown> = {},
  { pageSize = DEFAULT_PAGE_SIZE, ...config }: AxiosRequestConfig & { pageSize?: number } = {},
): Promise<Paginated<T>> {
  const cleaned = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  );
  const { data } = await apiClient.get<Paginated<T>>(url, {
    ...config,
    params: { page, page_size: pageSize, ...cleaned },
  });
  return data;
}
