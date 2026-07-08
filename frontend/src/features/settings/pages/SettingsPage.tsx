import {
  Bell,
  Building2,
  ChevronRight,
  ClipboardList,
  KanbanSquare,
  Package,
  ScrollText,
  Tag,
  Users,
  Wrench,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePermissionCheck } from "@/features/auth/usePermission";

// `permission` (opcional): quando presente, o card só aparece se o usuário tiver
// a permissão (o superuser sempre vê tudo).
const SETTINGS_CARDS = [
  {
    to: "/settings/workshop",
    icon: Building2,
    title: "Dados da Oficina",
    description: "Dados institucionais, contato e endereço usados nos documentos e PDFs.",
    permission: "settings.view",
  },
  {
    to: "/settings/orders",
    icon: ClipboardList,
    title: "Configurações da OS",
    description: "Prazo padrão de entrega e termos padrão das Ordens de Serviço.",
    permission: "settings.view",
  },
  {
    to: "/settings/kanban",
    icon: KanbanSquare,
    title: "Kanban OS",
    description: "Escolha quais colunas de status aparecem no Kanban e em que ordem.",
    permission: "settings.view",
  },
  {
    to: "/settings/notification-templates",
    icon: Bell,
    title: "Templates de Notificação ao Cliente",
    description:
      "Modelos profissionais e configuráveis das comunicações da oficina com o cliente (e-mail, WhatsApp, SMS e interno).",
    permission: "notifications.view",
  },
  {
    to: "/users",
    icon: Users,
    title: "Usuários",
    description:
      "Cadastro de usuários com perfis e especialidade técnica. As permissões individuais são ajustadas pelo superuser.",
    permission: "users.manage",
  },
  {
    to: "/audit",
    icon: ScrollText,
    title: "Auditoria",
    description: "Registro das ações sensíveis de usuários e permissões.",
    permission: "audit.view",
  },
  {
    to: "/settings/categories",
    icon: Tag,
    title: "Categorias de Clientes",
    description: "Gerencie as categorias de clientes do sistema.",
  },
  {
    to: "/settings/categories/parts",
    icon: Package,
    title: "Categorias de Peças",
    description: "Gerencie as categorias de peças do sistema.",
  },
  {
    to: "/settings/categories/services",
    icon: Wrench,
    title: "Categorias de Serviços",
    description: "Gerencie as categorias de serviços do sistema.",
  },
] as const;

export function SettingsPage() {
  const can = usePermissionCheck();
  const cards = SETTINGS_CARDS.filter(
    (card) => !("permission" in card) || can(card.permission),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Áreas administrativas e configuráveis do sistema.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ to, icon: Icon, title, description }) => (
          <Link key={to} to={to}>
            <Card className="h-full transition-colors hover:bg-accent/50">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <Icon className="size-4 text-primary" />
                    {title}
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
