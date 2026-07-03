import { useMutation } from "@tanstack/react-query";
import { ShieldCheck, Sparkles } from "lucide-react";
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
