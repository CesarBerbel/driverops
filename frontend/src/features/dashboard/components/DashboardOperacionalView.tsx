import {
  Boxes,
  Building2,
  Car,
  ChevronRight,
  Settings,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePermissionCheck } from "@/features/auth/usePermission";

import { OrdersHeroCard } from "./OrdersHeroCard";

const MODULE_CARDS: {
  to: string;
  icon: typeof Users;
  title: string;
  description: string;
  permission?: string;
}[] = [
  {
    to: "/customers",
    icon: Users,
    title: "Clientes",
    description: "Cadastre e gerencie os clientes do sistema.",
  },
  {
    to: "/vehicles",
    icon: Car,
    title: "Veículos",
    description: "Cadastre os veículos vinculados aos clientes.",
  },
  {
    to: "/suppliers",
    icon: Building2,
    title: "Fornecedores",
    description: "Cadastre os fornecedores de peças do sistema.",
  },
  {
    to: "/parts",
    icon: Boxes,
    title: "Estoque",
    description: "Cadastre e controle as peças em estoque.",
  },
  {
    to: "/services",
    icon: Wrench,
    title: "Serviços",
    description: "Cadastre serviços, peças padrão e pacotes de serviços.",
  },
  {
    to: "/financial",
    icon: Wallet,
    title: "Financeiro",
    description: "Contas a receber e pagamentos das ordens de serviço.",
    permission: "financial.view",
  },
  {
    to: "/settings",
    icon: Settings,
    title: "Configurações",
    description: "Acesse as áreas administrativas do sistema.",
  },
];

export function DashboardOperacionalView() {
  const can = usePermissionCheck();
  const moduleCards = MODULE_CARDS.filter(
    (card) => !card.permission || can(card.permission),
  );

  return (
    <div className="space-y-6">
      {/* Ordem de Serviço em destaque -- funcionalidade central do sistema. */}
      <OrdersHeroCard />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {moduleCards.map(({ to, icon: Icon, title, description }) => (
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
