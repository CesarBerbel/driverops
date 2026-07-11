import { useMutation } from "@tanstack/react-query";
import { Car, MailCheck } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { requestVehicleAccess } from "../api";

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
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Car className="size-6" />
          </div>
          <CardTitle>Consultar meu veículo</CardTitle>
          <p className="text-sm text-muted-foreground">
            Informe a placa do veículo para acompanhar o andamento na oficina.
          </p>
        </CardHeader>
        <CardContent>
          {mutation.isSuccess ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <MailCheck className="size-8 text-success" />
              <p className="text-sm text-muted-foreground">
                {mutation.data?.detail ??
                  "Se encontrarmos um veículo com estes dados, enviaremos um link de acesso para o e-mail cadastrado."}
              </p>
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
              <Button type="submit" className="w-full" disabled={mutation.isPending || !plate.trim()}>
                {mutation.isPending ? "Enviando..." : "Receber link de acesso"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Enviaremos um link seguro e temporário para o e-mail cadastrado no
                veículo.
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
