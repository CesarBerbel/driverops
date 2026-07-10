import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { PageLoader } from "@/components/loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissionCheck } from "@/features/auth/usePermission";

import { listSuggestions } from "../api";
import { CATEGORY_OPTIONS, PRIORITY_OPTIONS, STATUS_FILTERS } from "../constants";
import { CrmTabs } from "../CrmTabs";
import { SuggestionCard } from "../SuggestionCard";

const ALL = "all";

export function CrmPage() {
  const can = usePermissionCheck();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  // Deep link vindo da notificação (/crm?suggestion=<id>): abre direto a
  // mensagem daquela ação. Capturamos o id na montagem e limpamos a URL.
  const [autoOpenId] = useState(() => {
    const raw = searchParams.get("suggestion");
    return raw ? Number(raw) : null;
  });
  const [status, setStatus] = useState(autoOpenId ? "" : "open");
  const [priority, setPriority] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (searchParams.has("suggestion")) {
      const next = new URLSearchParams(searchParams);
      next.delete("suggestion");
      setSearchParams(next, { replace: true });
    }
    // Só na montagem: consome o parâmetro de deep link uma vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filters = {
    open: status === "open" ? "1" : undefined,
    status: status && status !== "open" ? status : undefined,
    priority: priority === ALL ? undefined : priority,
    category: category === ALL ? undefined : category,
    q: search || undefined,
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["crm-suggestions", filters],
    queryFn: () => listSuggestions(filters),
  });

  function onChanged() {
    queryClient.invalidateQueries({ queryKey: ["crm-suggestions"] });
    queryClient.invalidateQueries({ queryKey: ["crm-pending"] });
  }

  if (!can("crm.view")) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
        <Lock className="size-7 opacity-60" />
        <p className="text-sm">Você não tem permissão para ver o CRM inteligente.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Sparkles className="size-5 text-primary" /> CRM Inteligente — Próximas Ações
        </h1>
        <p className="text-sm text-muted-foreground">
          Sugestões de relacionamento e follow-up. Nada é enviado sem a sua confirmação.
        </p>
      </div>

      <CrmTabs />

      <div className="space-y-2">
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((t) => (
            <Button
              key={t.value || "todas"}
              size="sm"
              variant={status === t.value ? "default" : "outline"}
              onClick={() => setStatus(t.value)}
            >
              {t.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as prioridades</SelectItem>
              {PRIORITY_OPTIONS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as categorias</SelectItem>
              {CATEGORY_OPTIONS.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="w-56"
            placeholder="Buscar por motivo ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <PageLoader label="Carregando sugestões..." />
      ) : isError ? (
        <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
          Não foi possível carregar as sugestões do CRM inteligente. Tente novamente.
          <div className="mt-3">
            <Button size="sm" variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
          </div>
        </div>
      ) : !data || data.length === 0 ? (
        <div className="rounded-md border p-10 text-center text-sm text-muted-foreground">
          <Sparkles className="mx-auto mb-3 size-8 opacity-40" />
          <p className="font-medium text-foreground">Nenhuma sugestão inteligente agora.</p>
          <p>Quando houver oportunidades de contato, follow-up ou campanhas, elas aparecerão aqui.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((s) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              onChanged={onChanged}
              autoOpenMessage={s.id === autoOpenId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
