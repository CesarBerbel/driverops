import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { PasswordInput } from "@/components/shared/PasswordInput";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword, updateProfile } from "@/features/auth/api";
import { useAuth } from "@/features/auth/useAuth";
import {
  changePasswordSchema,
  profileSchema,
  type ChangePasswordFormValues,
  type ProfileFormValues,
} from "@/features/auth/schemas";
import { extractErrorMessage } from "@/lib/api-client";

export function ProfilePage() {
  const { user, refetch } = useAuth();

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: { full_name: user?.full_name ?? "" },
  });

  const passwordForm = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
  });

  const profileMutation = useMutation({
    mutationFn: (values: ProfileFormValues) => updateProfile(values.full_name),
    onSuccess: async () => {
      await refetch();
      toast.success("Perfil atualizado com sucesso.");
    },
    onError: (error) => toast.error(extractErrorMessage(error, "Não foi possível atualizar o perfil.")),
  });

  const passwordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: async () => {
      passwordForm.reset({
        current_password: "",
        new_password: "",
        new_password_confirm: "",
      });
      // Atualiza o usuário (limpa "trocar senha no 1º acesso" se estava ativo).
      await refetch();
      toast.success("Senha alterada com sucesso.");
    },
    onError: (error) => toast.error(extractErrorMessage(error, "Não foi possível alterar a senha.")),
  });

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
        <p className="text-muted-foreground">Gerencie suas informações e sua senha.</p>
      </div>

      <Card>
        <form onSubmit={profileForm.handleSubmit((values) => profileMutation.mutate(values))}>
          <CardHeader>
            <CardTitle className="text-base">Informações da conta</CardTitle>
            <CardDescription>Seus dados básicos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" value={user.email} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="full_name">Nome</Label>
              <Input
                id="full_name"
                aria-invalid={Boolean(profileForm.formState.errors.full_name)}
                {...profileForm.register("full_name")}
              />
              {profileForm.formState.errors.full_name && (
                <p className="text-sm text-destructive">
                  {profileForm.formState.errors.full_name.message}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={profileMutation.isPending}>
              {profileMutation.isPending && <Loader2 className="animate-spin" />}
              Salvar alterações
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Perfil e acesso</CardTitle>
          <CardDescription>Seu papel e nível de acesso no sistema.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Perfil</p>
            <p className="text-sm font-medium">
              {user.is_superuser ? "Superuser" : user.role_name || "—"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Especialidade</p>
            <p className="text-sm font-medium">
              {user.technical_specialty_display || "—"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Permissões</p>
            <p className="text-sm font-medium">
              {user.is_superuser
                ? "Acesso total"
                : `${user.permissions.length} permissõe(s)`}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <form
          onSubmit={passwordForm.handleSubmit((values) => passwordMutation.mutate(values))}
          noValidate
        >
          <CardHeader>
            <CardTitle className="text-base">Alterar senha</CardTitle>
            <CardDescription>Informe sua senha atual e a nova senha desejada.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current_password">Senha atual</Label>
              <PasswordInput
                id="current_password"
                autoComplete="current-password"
                aria-invalid={Boolean(passwordForm.formState.errors.current_password)}
                {...passwordForm.register("current_password")}
              />
              {passwordForm.formState.errors.current_password && (
                <p className="text-sm text-destructive">
                  {passwordForm.formState.errors.current_password.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_password">Nova senha</Label>
              <PasswordInput
                id="new_password"
                autoComplete="new-password"
                aria-invalid={Boolean(passwordForm.formState.errors.new_password)}
                {...passwordForm.register("new_password")}
              />
              {passwordForm.formState.errors.new_password && (
                <p className="text-sm text-destructive">
                  {passwordForm.formState.errors.new_password.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_password_confirm">Confirmar nova senha</Label>
              <PasswordInput
                id="new_password_confirm"
                autoComplete="new-password"
                aria-invalid={Boolean(passwordForm.formState.errors.new_password_confirm)}
                {...passwordForm.register("new_password_confirm")}
              />
              {passwordForm.formState.errors.new_password_confirm && (
                <p className="text-sm text-destructive">
                  {passwordForm.formState.errors.new_password_confirm.message}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={passwordMutation.isPending}>
              {passwordMutation.isPending && <Loader2 className="animate-spin" />}
              Alterar senha
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
