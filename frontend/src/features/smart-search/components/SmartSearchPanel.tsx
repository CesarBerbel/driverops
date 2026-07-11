import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2, Search, SearchX } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Input } from "@/components/ui/input";

import { getRecentSearches, getSearchSuggestions, smartSearch } from "../api";
import type { SearchResult } from "../types";
import { SearchAppliedFilters } from "./SearchAppliedFilters";
import { SearchResultGroup } from "./SearchResultGroup";
import { SearchSuggestionChips } from "./SearchSuggestionChips";

export function SmartSearchPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");

  const search = useMutation({
    mutationFn: (q: string) => smartSearch(q),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["smart-search", "recent"] }),
  });

  const suggestions = useQuery({
    queryKey: ["smart-search", "suggestions"],
    queryFn: getSearchSuggestions,
    staleTime: 5 * 60 * 1000,
  });
  const recent = useQuery({
    queryKey: ["smart-search", "recent"],
    queryFn: getRecentSearches,
    staleTime: 60 * 1000,
  });

  function runSearch(q: string) {
    const trimmed = q.trim();
    if (trimmed) search.mutate(trimmed);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    runSearch(query);
  }

  function pick(q: string) {
    setQuery(q);
    runSearch(q);
  }

  function select(result: SearchResult) {
    navigate(result.url);
    onClose();
  }

  const data = search.data;

  return (
    <div className="flex max-h-[80svh] flex-col">
      <form onSubmit={submit} className="flex items-center gap-2 border-b p-3">
        <Search className="size-5 shrink-0 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pergunte em linguagem natural: OS com luz de freio acesa..."
          aria-label="Busca inteligente"
          className="h-11 border-0 px-0 text-base shadow-none focus-visible:ring-0"
        />
        {search.isPending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </form>

      <div className="min-h-[240px] flex-1 space-y-4 overflow-y-auto p-4">
        {search.isPending && (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
            Interpretando sua pergunta e buscando...
          </div>
        )}

        {search.isError && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <AlertCircle className="size-7 text-destructive" />
            <p className="text-sm font-medium">Não foi possível concluir a busca agora.</p>
            <p className="text-sm text-muted-foreground">
              Tente novamente em instantes ou use outras palavras.
            </p>
          </div>
        )}

        {!search.isPending && !search.isError && data && (
          <>
            <SearchAppliedFilters filters={data.applied_filters} usedAi={data.used_ai} />
            {data.total === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <SearchX className="size-7 text-muted-foreground" />
                <p className="text-sm font-medium">Não encontrei resultados para essa busca.</p>
                <p className="text-sm text-muted-foreground">
                  Tente outras palavras, informe uma data ou pesquise por cliente, placa ou serviço.
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  {data.total} resultado{data.total === 1 ? "" : "s"} encontrado
                  {data.total === 1 ? "" : "s"}
                  {data.truncated && " (mostrando os mais relevantes)"}
                  {data.truncated && ". Refine por período, status ou tipo."}
                </p>
                {data.groups.map((group) => (
                  <SearchResultGroup key={group.type} group={group} onSelect={select} />
                ))}
              </>
            )}
          </>
        )}

        {!search.isPending && !search.isError && !data && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Digite o que deseja encontrar. Você pode buscar por OS, cliente, veículo, relato,
              diagnóstico, serviço ou peça.
            </p>
            <SearchSuggestionChips
              starters={suggestions.data?.starters ?? []}
              recent={(recent.data ?? []).map((r) => r.query)}
              onPick={pick}
            />
          </div>
        )}
      </div>
    </div>
  );
}
