import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailCheck, Truck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { extractErrorMessage } from "@/lib/api-client";

import { requestPasswordReset } from "../api";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "../schemas";

export function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(values: ForgotPasswordFormValues) {
    setServerError(null);
    try {
      await requestPasswordReset(values.email);
      setSubmitted(true);
    } catch (error) {
      setServerError(extractErrorMessage(error, "Não foi possível enviar o e-mail. Tente novamente."));
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
          <CardTitle className="text-xl">Recuperar senha</CardTitle>
          <CardDescription>
            Informe seu e-mail e enviaremos um link para redefinir sua senha.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <MailCheck className="size-8 text-success" />
              <p className="text-sm text-muted-foreground">
                Se este e-mail estiver cadastrado, você receberá um link de redefinição em
                instantes. Verifique sua caixa de entrada.
              </p>
            </div>
          ) : (
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
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              {serverError && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {serverError}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="animate-spin" />}
                Enviar link de redefinição
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
