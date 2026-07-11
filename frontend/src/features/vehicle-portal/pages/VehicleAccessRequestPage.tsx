import { useMutation } from "@tanstack/react-query";
import { Car, MailCheck, ShieldCheck } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { BackToSite } from "../components/BackToSite";
import { requestVehicleAccess } from "../api";

const NEUTRAL_MESSAGE =
  "Se encontrarmos um veículo com estes dados, enviaremos um link de acesso para o e-mail cadastrado.";

// Página pública: o cliente informa a placa e recebe um link de acesso por
// e-mail. A resposta é SEMPRE neutra -- nunca revela se a placa existe.
export function VehicleAccessRequestPage() {
  const [plate, setPlate] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot (invisível)

  const mutation = useMutation({
    mutationFn: () =>
      requestVehicleAccess({ plate, email: email || undefined, website }),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <div className="mx-auto w-full max-w-md px-4 pt-4">
        <BackToSite />
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Car className="size-6" />
            </div>
            <CardTitle>Consultar meu veículo</CardTitle>
            <p className="text-sm text-muted-foreground">
              Digite a placa do seu veículo. Se ele estiver cadastrado na oficina,
              enviaremos um link seguro para o e-mail registrado no atendimento.
            </p>
          </CardHeader>
          <CardContent>
            {mutation.isSuccess ? (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <MailCheck className="size-8 text-success" />
                <p className="text-sm text-muted-foreground">
                  {mutation.data?.detail ?? NEUTRAL_MESSAGE}
                </p>
                <p className="text-xs text-muted-foreground">
                  Verifique também a caixa de spam. O link é válido por tempo limitado
                  e nenhuma senha é necessária.
                </p>
                <div className="flex flex-col items-center gap-2 pt-1">
                  <Button
                    variant="outline"
                    onClick={() => {
                      mutation.reset();
                      setPlate("");
                      setEmail("");
                    }}
                  >
                    Consultar outra placa
                  </Button>
                  <BackToSite />
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="plate">Placa / matrícula</Label>
                  <Input
                    id="plate"
                    value={plate}
                    onChange={(e) => setPlate(e.target.value.toUpperCase())}
                    placeholder="ABC1D23"
                    autoCapitalize="characters"
                    autoComplete="off"
                    className="h-12 text-center text-lg font-semibold tracking-widest"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail (opcional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    autoComplete="email"
                    inputMode="email"
                  />
                </div>
                {/* Honeypot invisível: bots preenchem; humanos não veem. */}
                <input
                  type="text"
                  name="website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="hidden"
                />
                <Button
                  type="submit"
                  className="h-11 w-full"
                  disabled={mutation.isPending || !plate.trim()}
                >
                  {mutation.isPending ? "Enviando..." : "Enviar link de acesso"}
                </Button>

                <div className="flex items-start gap-2 rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
                  <span>
                    Enviamos o link apenas para o e-mail cadastrado no veículo. Nenhuma
                    senha é necessária e nunca informamos se uma placa existe.
                  </span>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mx-auto w-full max-w-md px-4 pb-6 text-center">
        <BackToSite label="Voltar para a página inicial" />
      </div>
    </div>
  );
}
