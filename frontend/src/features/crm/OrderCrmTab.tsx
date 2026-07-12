import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { listSuggestions } from "./api";
import { SuggestionCard } from "./SuggestionCard";

/** Aba "CRM" nos detalhes da OS: próximas ações sugeridas pelo CRM para a OS. */
export function OrderCrmTab({ workOrderId }: { workOrderId: number }) {
  const queryClient = useQueryClient();
  const filters = { work_order: workOrderId, open: "1" };

  const { data, isLoading } = useQuery({
    queryKey: ["crm-suggestions", filters],
    queryFn: () => listSuggestions(filters),
  });

  function onChanged() {
    queryClient.invalidateQueries({ queryKey: ["crm-suggestions"] });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-primary" /> Sugestões do CRM
        </CardTitle>
        <Link to="/crm" className="text-sm text-primary hover:underline">
          Abrir CRM
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </>
        ) : !data || data.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma sugestão do CRM para esta OS no momento. As próximas ações aparecem aqui
            automaticamente conforme o andamento da OS.
          </p>
        ) : (
          data.map((s) => <SuggestionCard key={s.id} suggestion={s} onChanged={onChanged} />)
        )}
      </CardContent>
    </Card>
  );
}
