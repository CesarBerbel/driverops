import { ListTodo, Sparkles } from "lucide-react";
import { NavLink } from "react-router-dom";

import { cn } from "@/lib/utils";

const tabClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
    isActive
      ? "bg-secondary text-secondary-foreground"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  );

/** Alterna entre as duas telas do CRM inteligente. */
export function CrmTabs() {
  return (
    <div className="flex flex-wrap gap-1">
      <NavLink to="/crm" end className={tabClass}>
        <Sparkles className="size-4" /> Próximas Ações
      </NavLink>
      <NavLink to="/crm/tasks" className={tabClass}>
        <ListTodo className="size-4" /> Tarefas
      </NavLink>
    </div>
  );
}
