import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, Truck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router-dom";

import { PasswordInput } from "@/components/shared/PasswordInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { extractErrorMessage } from "@/lib/api-client";

import { confirmPasswordReset } from "../api";
import { resetPasswordSchema, type ResetPasswordFormValues } from "../schemas";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const uid = searchParams.get("uid");
  const token = searchParams.get("token");

  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({ resolver: zodResolver(resetPasswordSchema) });

  async function onSubmit(values: ResetPasswordFormValues) {
    if (!uid || !token) return;
    setServerError(null);
    try {
      await confirmPasswordReset({ uid, token, ...values });
      setSuccess(true);
    } catch (error) {
      setServerError(
        extractErrorMessage(error, "Não foi possível redefinir a senha. Tente novamente."),
      );
    }
  }

  const linkIsMissing = !uid || !token;

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/30 px-4">
      <div className="flex items-center gap-2 text-primary">
        <Truck className="size-6" />
        <span className="text-lg font-semibold text-foreground">DriverOps</span>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Redefinir senha</CardTitle>
          <CardDescription>Escolha uma nova senha para sua conta.</CardDescription>
        </CardHeader>
        <CardContent>
          {linkIsMissing ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Este link de redefinição é inválido. Solicite um novo link na tela de recuperação de
              senha.
            </p>
          ) : success ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="size-8 text-success" />
              <p className="text-sm text-muted-foreground">
                Sua senha foi redefinida com sucesso. Você já pode entrar com a nova senha.
              </p>
              <Button asChild className="mt-2 w-full">
                <Link to="/login">Ir para o login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="new_password">Nova senha</Label>
                <PasswordInput
                  id="new_password"
                  autoComplete="new-password"
                  aria-invalid={Boolean(errors.new_password)}
                  {...register("new_password")}
                />
                {errors.new_password && (
                  <p className="text-sm text-destructive">{errors.new_password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="new_password_confirm">Confirmar nova senha</Label>
                <PasswordInput
                  id="new_password_confirm"
                  autoComplete="new-password"
                  aria-invalid={Boolean(errors.new_password_confirm)}
                  {...register("new_password_confirm")}
                />
                {errors.new_password_confirm && (
                  <p className="text-sm text-destructive">
                    {errors.new_password_confirm.message}
                  </p>
                )}
              </div>

              {serverError && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {serverError}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="animate-spin" />}
                Redefinir senha
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Link
        to="/login"
        className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Voltar para o login
      </Link>
    </div>
  );
}
