import { zodResolver } from "@hookform/resolvers/zod";
import { Truck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { ButtonLoader } from "@/components/loading";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/useAuth";
import { extractErrorMessage } from "@/lib/api-client";

import { GoogleSignInButton, googleAuthEnabled } from "../components/GoogleSignInButton";
import { loginSchema, type LoginFormValues } from "../schemas";

export function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  function redirectAfterLogin() {
    const from =
      (location.state as { from?: { pathname: string } } | null)?.from?.pathname ??
      "/dashboard";
    navigate(from, { replace: true });
  }

  async function onSubmit(values: LoginFormValues) {
    setServerError(null);
    try {
      await login(values.email, values.password);
      redirectAfterLogin();
    } catch (error) {
      setServerError(extractErrorMessage(error, "Não foi possível entrar. Tente novamente."));
    }
  }

  async function handleGoogleCredential(credential: string) {
    setServerError(null);
    try {
      await loginWithGoogle(credential);
      redirectAfterLogin();
    } catch (error) {
      setServerError(
        extractErrorMessage(error, "Não foi possível entrar com o Google."),
      );
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/30 px-4">
      <div className="flex items-center gap-2 text-primary">
        <Truck className="size-6" />
        <span className="text-lg font-semibold text-foreground">DriverOps</span>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Entrar</CardTitle>
          <CardDescription>Acesse sua conta para continuar.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="voce@exemplo.com"
                aria-invalid={Boolean(errors.email)}
                {...register("email")}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <Link
                  to="/forgot-password"
                  className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Esqueci minha senha
                </Link>
              </div>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            {serverError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {serverError}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <ButtonLoader label="Entrando..." /> : "Entrar"}
            </Button>
          </form>

          {googleAuthEnabled && (
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">ou</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <GoogleSignInButton onCredential={handleGoogleCredential} />
            </div>
          )}
        </CardContent>
      </Card>

      <Link
        to="/"
        className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Voltar para a página inicial
      </Link>
    </div>
  );
}
