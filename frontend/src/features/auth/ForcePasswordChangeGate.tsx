import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { Outlet } from "react-router-dom";
import { toast } from "sonner";

import { PasswordInput } from "@/components/shared/PasswordInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { extractErrorMessage } from "@/lib/api-client";

import { changePassword } from "./api";
import { changePasswordSchema, type ChangePasswordFormValues } from "./schemas";
import { useAuth } from "./useAuth";

// Bloqueia todo o app enquanto o usuário precisar trocar a senha no primeiro
// acesso (force_password_change). Após trocar, refetch libera o acesso.
export function ForcePasswordChangeGate() {
  const { user, refetch } = useAuth();

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
  });

  const mutation = useMutation({
    mutationFn: changePassword,
    onSuccess: async () => {
      await refetch();
      toast.success("Senha alterada. Bem-vindo(a)!");
    },
    onError: (error) =>
      toast.error(extractErrorMessage(error, "Não foi possível alterar a senha.")),
  });

  if (!user?.force_password_change) return <Outlet />;

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="size-5 text-primary" />
          </div>
          <CardTitle className="text-lg">Troque sua senha para continuar</CardTitle>
          <p className="text-sm text-muted-foreground">
            No seu primeiro acesso é necessário definir uma nova senha.
          </p>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="space-y-4"
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="current_password">Senha atual</Label>
              <PasswordInput
                id="current_password"
                autoComplete="current-password"
                aria-invalid={Boolean(form.formState.errors.current_password)}
                {...form.register("current_password")}
              />
              {form.formState.errors.current_password && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.current_password.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_password">Nova senha</Label>
              <PasswordInput
                id="new_password"
                autoComplete="new-password"
                aria-invalid={Boolean(form.formState.errors.new_password)}
                {...form.register("new_password")}
              />
              {form.formState.errors.new_password && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.new_password.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_password_confirm">Confirmar nova senha</Label>
              <PasswordInput
                id="new_password_confirm"
                autoComplete="new-password"
                aria-invalid={Boolean(form.formState.errors.new_password_confirm)}
                {...form.register("new_password_confirm")}
              />
              {form.formState.errors.new_password_confirm && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.new_password_confirm.message}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="animate-spin" />}
              Definir nova senha
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
