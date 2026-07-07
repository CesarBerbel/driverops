import { useMutation } from "@tanstack/react-query";
import {
  Boxes,
  Building2,
  Car,
  ChevronRight,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { adminPing } from "@/features/auth/api";
import { useAuth } from "@/features/auth/useAuth";
import { usePermissionCheck } from "@/features/auth/usePermission";
import { extractErrorMessage } from "@/lib/api-client";

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
  const { user } = useAuth();
  const can = usePermissionCheck();
  const moduleCards = MODULE_CARDS.filter(
    (card) => !card.permission || can(card.permission),
  );

  const pingMutation = useMutation({
    mutationFn: adminPing,
    onSuccess: (data) => toast.success(data.detail),
    onError: (error) => toast.error(extractErrorMessage(error, "Falha ao acessar o recurso.")),
  });

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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-primary" />
              Pronto para crescer
            </CardTitle>
            <CardDescription>
              Este espaço está preparado para novos módulos e indicadores nas próximas versões.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sua conta</CardTitle>
            <CardDescription>
              Perfil: {user?.is_superuser ? "Superusuário" : "Usuário"}
            </CardDescription>
          </CardHeader>
        </Card>

        {user?.is_superuser && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4 text-primary" />
                Recurso administrativo
              </CardTitle>
              <CardDescription>
                Exemplo de ação disponível apenas para superusuários.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                size="sm"
                variant="outline"
                onClick={() => pingMutation.mutate()}
                disabled={pingMutation.isPending}
              >
                Testar acesso administrativo
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
