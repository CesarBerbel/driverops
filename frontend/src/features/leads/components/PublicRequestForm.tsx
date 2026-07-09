import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { normalizePlate } from "@/features/vehicles/plate";
import { extractErrorMessage } from "@/lib/api-client";
import { formatPhone } from "@/lib/masks";

import { getLeadPublicConfig, submitLeadRequest } from "../api";

interface PublicRequestFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: string;
}

const EMPTY = {
  name: "",
  phone: "",
  email: "",
  vehicle_plate: "",
  vehicle_brand: "",
  vehicle_model: "",
  vehicle_year: "",
  request_type: "",
  best_period: "any",
  desired_date: "",
  message: "",
  consent: false,
  website: "", // honeypot
};

export function PublicRequestForm({ open, onOpenChange, defaultType }: PublicRequestFormProps) {
  const [form, setForm] = useState({ ...EMPTY });
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const configQuery = useQuery({
    queryKey: ["lead-public-config"],
    queryFn: getLeadPublicConfig,
    enabled: open,
  });
  const config = configQuery.data;

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY, request_type: defaultType ?? "" });
      setDone(false);
      setError(null);
    }
  }, [open, defaultType]);

  const mutation = useMutation({
    mutationFn: () =>
      submitLeadRequest({
        name: form.name.trim(),
        phone: form.phone,
        email: form.email || undefined,
        vehicle_plate: form.vehicle_plate || undefined,
        vehicle_brand: form.vehicle_brand || undefined,
        vehicle_model: form.vehicle_model || undefined,
        vehicle_year: form.vehicle_year ? Number(form.vehicle_year) : null,
        request_type: form.request_type || "other",
        best_period: form.best_period,
        desired_date: form.desired_date || null,
        message: form.message || undefined,
        consent: form.consent,
        website: form.website,
      }),
    onSuccess: () => setDone(true),
    onError: (err) => setError(extractErrorMessage(err, "Não foi possível enviar o pedido.")),
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const plateRequired = config ? config.plate_required && !config.allow_without_vehicle : false;
  const emailRequired = config?.email_required ?? false;
  const consentRequired = config?.require_consent ?? true;

  const canSubmit =
    form.name.trim().length >= 2 &&
    form.phone.replace(/\D/g, "").length >= 10 &&
    (!plateRequired || form.vehicle_plate.trim().length >= 5) &&
    (!emailRequired || form.email.trim().length > 3) &&
    (!consentRequired || form.consent);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        {done ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="size-12 text-emerald-500" />
            <DialogTitle>Pedido recebido!</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Pedido recebido com sucesso. A oficina foi avisada e entrará em contato pelo
              telefone informado.
            </p>
            <Button onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Solicitar atendimento</DialogTitle>
              <DialogDescription>
                Deixe seus dados e a nossa equipe entra em contato para confirmar o melhor
                horário e entender o que seu veículo precisa. Você não precisa criar conta.
              </DialogDescription>
            </DialogHeader>

            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (canSubmit) mutation.mutate();
              }}
            >
              {/* Honeypot invisível */}
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="hidden"
                value={form.website}
                onChange={(e) => set("website", e.target.value)}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="lead-name">Seu nome *</Label>
                  <Input id="lead-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lead-phone">Telefone / WhatsApp *</Label>
                  <Input
                    id="lead-phone"
                    inputMode="tel"
                    placeholder="(11) 99999-9999"
                    value={form.phone}
                    onChange={(e) => set("phone", formatPhone(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lead-email">E-mail{emailRequired ? " *" : " (opcional)"}</Label>
                <Input
                  id="lead-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </div>

              {!config?.allow_without_vehicle && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="lead-plate">Placa{plateRequired ? " *" : ""}</Label>
                    <Input
                      id="lead-plate"
                      placeholder="ABC1D23"
                      autoCapitalize="characters"
                      maxLength={7}
                      value={form.vehicle_plate}
                      onChange={(e) => set("vehicle_plate", normalizePlate(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lead-brand">Marca</Label>
                    <Input id="lead-brand" value={form.vehicle_brand} onChange={(e) => set("vehicle_brand", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lead-model">Modelo</Label>
                    <Input id="lead-model" value={form.vehicle_model} onChange={(e) => set("vehicle_model", e.target.value)} />
                  </div>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Tipo de solicitação</Label>
                  <Select value={form.request_type} onValueChange={(v) => set("request_type", v)}>
                    <SelectTrigger aria-label="Tipo de solicitação">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {(config?.request_types ?? []).map((t) => (
                        <SelectItem key={t.key} value={t.key}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Melhor período para contato</Label>
                  <Select value={form.best_period} onValueChange={(v) => set("best_period", v)}>
                    <SelectTrigger aria-label="Período">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(config?.periods ?? []).map((p) => (
                        <SelectItem key={p.key} value={p.key}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lead-message">Conte o que está acontecendo com seu carro</Label>
                <Textarea
                  id="lead-message"
                  value={form.message}
                  onChange={(e) => set("message", e.target.value)}
                  className="min-h-20"
                />
              </div>

              {consentRequired && (
                <label className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={form.consent}
                    onCheckedChange={(v) => set("consent", v)}
                    aria-label="Autorizo o contato"
                  />
                  Autorizo a oficina a entrar em contato pelos dados informados.
                </label>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={!canSubmit || mutation.isPending}>
                {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
                Enviar pedido
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
