import {
  BarChart3,
  Bell,
  Car,
  ClipboardList,
  DollarSign,
  Inbox,
  KanbanSquare,
  type LucideIcon,
  Package,
  ScrollText,
  Settings,
  Sparkles,
  Truck,
  UserCog,
  Users,
  Wrench,
} from "lucide-react";

export interface MoreItem {
  label: string;
  path: string;
  icon: LucideIcon;
  // Código de permissão exigido (opcional). Ausente = visível a todo usuário.
  permission?: string;
}

export interface MoreGroup {
  title: string;
  items: MoreItem[];
}

// Módulos do menu "Mais", agrupados. IMPORTANTE: NÃO existe item de "Orçamentos"
// -- o orçamento é parte da própria OS (acessado por dentro da OS ou por filtros
// na listagem de OS). Só entram rotas que realmente existem no sistema.
export const MORE_GROUPS: MoreGroup[] = [
  {
    title: "Operação",
    items: [
      { label: "Ordens de Serviço", path: "/orders", icon: ClipboardList },
      { label: "Kanban OS", path: "/kanban", icon: KanbanSquare, permission: "kanban.view" },
      { label: "Pedidos do site", path: "/leads", icon: Inbox, permission: "leads.view" },
      { label: "Notificações", path: "/notifications", icon: Bell, permission: "alerts.view" },
    ],
  },
  {
    title: "Cadastros",
    items: [
      { label: "Clientes", path: "/customers", icon: Users },
      { label: "Veículos", path: "/vehicles", icon: Car },
      { label: "Serviços", path: "/services", icon: Wrench },
      { label: "Peças / Estoque", path: "/parts", icon: Package },
      { label: "Fornecedores", path: "/suppliers", icon: Truck },
    ],
  },
  {
    title: "Gestão",
    items: [
      { label: "Financeiro", path: "/financial", icon: DollarSign, permission: "financial.view" },
      {
        label: "Relatórios",
        path: "/financial/reports",
        icon: BarChart3,
        permission: "financial.reports",
      },
      { label: "CRM Inteligente", path: "/crm", icon: Sparkles, permission: "crm.view" },
    ],
  },
  {
    title: "Administração",
    items: [
      { label: "Configurações", path: "/settings", icon: Settings },
      { label: "Usuários", path: "/users", icon: UserCog, permission: "users.manage" },
      { label: "Auditoria", path: "/audit", icon: ScrollText, permission: "audit.view" },
    ],
  },
];

// Filtra os grupos pelas permissões do usuário; descarta grupos que ficaram
// sem nenhum item visível.
export function visibleMoreGroups(can: (code: string) => boolean): MoreGroup[] {
  return MORE_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || can(item.permission)),
  })).filter((group) => group.items.length > 0);
}
