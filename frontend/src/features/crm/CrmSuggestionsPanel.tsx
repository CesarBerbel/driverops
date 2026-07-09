import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePermissionCheck } from "@/features/auth/usePermission";

import { listSuggestions } from "./api";
import { SuggestionCard } from "./SuggestionCard";

/** Sugestões contextuais do CRM para uma OS (some quando não há nenhuma). */
export function CrmSuggestionsPanel({ workOrderId }: { workOrderId: number }) {
  const can = usePermissionCheck();
  const queryClient = useQueryClient();
  const filters = { work_order: workOrderId, open: "1" };

  const { data } = useQuery({
    queryKey: ["crm-suggestions", filters],
    queryFn: () => listSuggestions(filters),
    enabled: can("crm.view"),
  });

  if (!can("crm.view") || !data || data.length === 0) return null;

  function onChanged() {
    queryClient.invalidateQueries({ queryKey: ["crm-suggestions"] });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-primary" /> Sugestões do CRM
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((s) => (
          <SuggestionCard key={s.id} suggestion={s} onChanged={onChanged} />
        ))}
      </CardContent>
    </Card>
  );
}
