import { Check, Clock, MessageSquare, ThumbsDown, ListTodo, Megaphone } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePermissionCheck } from "@/features/auth/usePermission";
import { extractErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

import {
  approveSuggestion,
  completeSuggestion,
  dismissSuggestion,
  snoozeSuggestion,
  toCampaign,
  toTask,
} from "./api";
import { PRIORITY } from "./constants";
import { MessageDialog } from "./MessageDialog";
import type { Suggestion } from "./types";

export function SuggestionCard({
  suggestion,
  onChanged,
}: {
  suggestion: Suggestion;
  onChanged: (s: Suggestion) => void;
}) {
  const can = usePermissionCheck();
  const [msgOpen, setMsgOpen] = useState(false);
  const prio = PRIORITY[suggestion.priority];
  const open = ["new", "in_analysis", "scheduled", "in_progress", "snoozed"].includes(
    suggestion.status,
  );

  async function run(fn: () => Promise<Suggestion>, ok?: string) {
    try {
      onChanged(await fn());
      if (ok) toast.success(ok);
    } catch (e) {
      toast.error(extractErrorMessage(e, "Não foi possível executar a ação."));
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("size-2.5 rounded-full", prio.dot)} />
              <span className="font-medium">{suggestion.suggestion_type_display}</span>
              <Badge variant="outline" className={prio.badge}>
                {prio.label}
              </Badge>
              <Badge variant="outline">{suggestion.status_display}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{suggestion.reason}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {suggestion.customer_name && (
            <span>
              <span className="text-muted-foreground">Cliente:</span>{" "}
              {suggestion.customer ? (
                <Link className="text-primary hover:underline" to={`/customers/${suggestion.customer}/360`}>
                  {suggestion.customer_name}
                </Link>
              ) : (
                suggestion.customer_name
              )}
            </span>
          )}
          {suggestion.vehicle_plate && (
            <span>
              <span className="text-muted-foreground">Veículo:</span> {suggestion.vehicle_plate}
            </span>
          )}
          {suggestion.work_order_number && (
            <Link className="text-primary hover:underline" to={`/orders/${suggestion.work_order}`}>
              OS #{suggestion.work_order_number}
            </Link>
          )}
        </div>

        <p className="text-sm">
          <span className="text-muted-foreground">Ação recomendada:</span>{" "}
          {suggestion.recommended_action}
        </p>

        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="outline" onClick={() => setMsgOpen(true)}>
            <MessageSquare className="size-4" /> Mensagem
          </Button>
          {open && can("crm.manage") && suggestion.status === "new" && (
            <Button size="sm" variant="ghost" onClick={() => run(() => approveSuggestion(suggestion.id), "Aprovada.")}>
              <Check className="size-4" /> Aprovar
            </Button>
          )}
          {open && can("crm.assign_task") && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                run(async () => {
                  await toTask(suggestion.id, suggestion.recommended_action);
                  return suggestion;
                }, "Tarefa criada.")
              }
            >
              <ListTodo className="size-4" /> Tarefa
            </Button>
          )}
          {open && can("crm.create_campaign") && suggestion.category === "campaign" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                run(async () => {
                  await toCampaign(suggestion.id);
                  return suggestion;
                }, "Campanha criada (rascunho).")
              }
            >
              <Megaphone className="size-4" /> Campanha
            </Button>
          )}
          {open && can("crm.manage") && (
            <Button size="sm" variant="ghost" onClick={() => run(() => snoozeSuggestion(suggestion.id, { days: 2 }), "Adiada.")}>
              <Clock className="size-4" /> Adiar
            </Button>
          )}
          {open && can("crm.manage") && (
            <Button size="sm" variant="ghost" onClick={() => run(() => completeSuggestion(suggestion.id), "Concluída.")}>
              <Check className="size-4" /> Concluir
            </Button>
          )}
          {open && can("crm.dismiss") && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => run(() => dismissSuggestion(suggestion.id), "Ignorada.")}
            >
              <ThumbsDown className="size-4" /> Ignorar
            </Button>
          )}
        </div>
      </CardContent>

      <MessageDialog
        open={msgOpen}
        onOpenChange={setMsgOpen}
        suggestion={suggestion}
        onChanged={onChanged}
      />
    </Card>
  );
}
