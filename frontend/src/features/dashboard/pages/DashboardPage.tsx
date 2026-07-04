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
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { adminPing } from "@/features/auth/api";
import { useAuth } from "@/features/auth/useAuth";
import { extractErrorMessage } from "@/lib/api-client";

export function DashboardPage() {
  const { user } = useAuth();

  const pingMutation = useMutation({
    mutationFn: adminPing,
    onSuccess: (data) => toast.success(data.detail),
    onError: (error) => toast.error(extractErrorMessage(error, "Falha ao acessar o recurso.")),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Bem-vindo, {user?.full_name || user?.email}
        </h1>
        <p className="text-muted-foreground">Este é o painel inicial do DriverOps.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link to="/customers">
          <Card className="h-full transition-colors hover:bg-accent/50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Users className="size-4 text-primary" />
                  Clientes
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </CardTitle>
              <CardDescription>Cadastre e gerencie os clientes do sistema.</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link to="/vehicles">
          <Card className="h-full transition-colors hover:bg-accent/50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Car className="size-4 text-primary" />
                  Veículos
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </CardTitle>
              <CardDescription>Cadastre os veículos vinculados aos clientes.</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link to="/suppliers">
          <Card className="h-full transition-colors hover:bg-accent/50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Building2 className="size-4 text-primary" />
                  Fornecedores
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </CardTitle>
              <CardDescription>Cadastre os fornecedores de peças do sistema.</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link to="/parts">
          <Card className="h-full transition-colors hover:bg-accent/50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Boxes className="size-4 text-primary" />
                  Estoque
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </CardTitle>
              <CardDescription>Cadastre e controle as peças em estoque.</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link to="/settings">
          <Card className="h-full transition-colors hover:bg-accent/50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Settings className="size-4 text-primary" />
                  Configurações
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </CardTitle>
              <CardDescription>Acesse as áreas administrativas do sistema.</CardDescription>
            </CardHeader>
          </Card>
        </Link>

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
