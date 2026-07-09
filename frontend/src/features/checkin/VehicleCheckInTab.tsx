import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, CheckCircle2, ClipboardCheck, Loader2, Lock, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PageLoader } from "@/components/loading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { usePermissionCheck } from "@/features/auth/usePermission";
import { extractErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

import {
  addBelonging,
  addGeneralPhoto,
  completeCheckIn,
  deleteBelonging,
  deleteGeneralPhoto,
  getCheckIn,
  reopenCheckIn,
  setItems,
  startCheckIn,
  updateCheckIn,
} from "./api";
import { CarMap } from "./CarMap";
import {
  FUEL_OPTIONS,
  ITEM_STATUS,
  ITEM_STATUS_ORDER,
  PHOTO_CATEGORY_OPTIONS,
  SEVERITY,
} from "./constants";
import { DamageDialog } from "./DamageDialog";
import type { CheckIn, Damage, ItemStatus } from "./types";

export function VehicleCheckInTab({ orderId }: { orderId: number }) {
  const queryClient = useQueryClient();
  const can = usePermissionCheck();
  const key = ["checkin", orderId];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: key,
    queryFn: () => getCheckIn(orderId),
  });

  function apply(checkIn: CheckIn) {
    queryClient.setQueryData(key, checkIn);
  }

  const startMut = useMutation({
    mutationFn: () => startCheckIn(orderId),
    onSuccess: apply,
    onError: (e) => toast.error(extractErrorMessage(e, "Não foi possível iniciar o check-in.")),
  });

  if (!can("checkin.view")) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
        <Lock className="size-7 opacity-60" />
        <p className="text-sm">Você não tem permissão para ver o check-in.</p>
      </div>
    );
  }

  if (isLoading) return <PageLoader label="Carregando check-in..." />;
  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-sm text-muted-foreground">Não foi possível carregar o check-in.</p>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <ClipboardCheck className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Check-in ainda não iniciado</p>
            <p className="text-sm text-muted-foreground">
              Registre o estado do veículo (avarias, fotos e itens) no recebimento.
            </p>
          </div>
          {can("checkin.edit") && (
            <Button onClick={() => startMut.mutate()} disabled={startMut.isPending}>
              {startMut.isPending && <Loader2 className="size-4 animate-spin" />}
              Iniciar check-in
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return <CheckInBody checkIn={data} apply={apply} can={can} />;
}

interface BodyProps {
  checkIn: CheckIn;
  apply: (c: CheckIn) => void;
  can: (code: string) => boolean;
}

function CheckInBody({ checkIn, apply, can }: BodyProps) {
  const canEdit = can("checkin.edit") && !checkIn.is_locked;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDamage, setEditingDamage] = useState<Damage | null>(null);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  function openNew(x: number, y: number) {
    setEditingDamage(null);
    setCoords({ x, y });
    setDialogOpen(true);
  }
  function openDamage(d: Damage) {
    setSelectedId(d.id);
    setEditingDamage(d);
    setCoords(null);
    setDialogOpen(true);
  }

  const complete = useMutation({
    mutationFn: (confirmEmpty: boolean) => completeCheckIn(checkIn.id, confirmEmpty),
    onSuccess: (c) => {
      apply(c);
      toast.success("Check-in concluído. As informações foram registradas no histórico da OS.");
    },
    onError: (e) => {
      const code = (e as { response?: { data?: { code?: string } } }).response?.data?.code;
      if (code === "empty") {
        if (window.confirm("Nenhuma avaria ou foto registrada. Concluir mesmo assim?")) {
          complete.mutate(true);
        }
        return;
      }
      toast.error(extractErrorMessage(e, "Não foi possível concluir o check-in."));
    },
  });

  const reopen = useMutation({
    mutationFn: () => reopenCheckIn(checkIn.id),
    onSuccess: (c) => {
      apply(c);
      toast.success("Check-in reaberto para edição.");
    },
    onError: (e) => toast.error(extractErrorMessage(e, "Não foi possível reabrir.")),
  });

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <Card>
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn(checkIn.is_locked && "border-emerald-400 text-emerald-600")}>
                {checkIn.status_display}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {checkIn.summary.damage_count} avaria(s) · {checkIn.summary.photo_count} foto(s) ·{" "}
                {checkIn.summary.absent_items_count} item(ns) ausente(s) · objetos:{" "}
                {checkIn.summary.has_belongings ? "sim" : "não"}
              </span>
            </div>
            {checkIn.completed_at ? (
              <p className="text-xs text-muted-foreground">
                Concluído por {checkIn.completed_by_name} em{" "}
                {new Date(checkIn.completed_at).toLocaleString("pt-BR")}.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Iniciado por {checkIn.created_by_name || "—"}.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {checkIn.is_locked
              ? can("checkin.reopen") && (
                  <Button size="sm" variant="outline" disabled={reopen.isPending} onClick={() => reopen.mutate()}>
                    Reabrir
                  </Button>
                )
              : can("checkin.complete") && (
                  <Button size="sm" disabled={complete.isPending} onClick={() => complete.mutate(false)}>
                    <CheckCircle2 className="size-4" /> Concluir check-in
                  </Button>
                )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Mapa */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mapa de avarias</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <CarMap
              damages={checkIn.damages}
              selectedId={selectedId}
              onAdd={openNew}
              onSelect={openDamage}
              readOnly={!canEdit}
            />
            <div className="flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="size-2.5 rounded-full bg-emerald-500" /> Leve
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2.5 rounded-full bg-amber-500" /> Média
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2.5 rounded-full bg-red-500" /> Grave
              </span>
            </div>
            {canEdit && (
              <p className="text-center text-xs text-muted-foreground">
                Clique no desenho do veículo para marcar avarias.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Lista de avarias */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Avarias registradas</CardTitle>
          </CardHeader>
          <CardContent>
            {checkIn.damages.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma avaria registrada até o momento.
              </p>
            ) : (
              <ul className="space-y-2">
                {checkIn.damages.map((d) => {
                  const sev = SEVERITY[d.severity];
                  return (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => openDamage(d)}
                        onMouseEnter={() => setSelectedId(d.id)}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-md border p-2 text-left hover:bg-accent",
                          selectedId === d.id && "ring-1 ring-primary",
                        )}
                      >
                        <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white", sev.dot)}>
                          {d.sequence}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <Badge variant="outline" className={sev.badge}>{sev.label}</Badge>
                            <span className="text-xs text-muted-foreground">{d.region_display}</span>
                          </span>
                          <p className="truncate text-sm">{d.description}</p>
                          {d.photos.length > 0 && (
                            <span className="text-xs text-muted-foreground">{d.photos.length} foto(s)</span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <GeneralPhotos checkIn={checkIn} apply={apply} canEdit={canEdit} />
      <Checklist checkIn={checkIn} apply={apply} canEdit={canEdit} />
      <Belongings checkIn={checkIn} apply={apply} canEdit={canEdit} />
      <GeneralFields checkIn={checkIn} apply={apply} canEdit={canEdit} />

      <DamageDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        checkInId={checkIn.id}
        damage={editingDamage}
        coords={coords}
        canEdit={canEdit}
        onChanged={apply}
      />
    </div>
  );
}

// --- Fotos gerais ---

function GeneralPhotos({ checkIn, apply, canEdit }: { checkIn: CheckIn; apply: (c: CheckIn) => void; canEdit: boolean }) {
  const [category, setCategory] = useState("front");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
    try {
      apply(await addGeneralPhoto(checkIn.id, file, category));
    } catch (e) {
      toast.error(extractErrorMessage(e, "Falha no upload."));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Fotos gerais do veículo</CardTitle>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PHOTO_CATEGORY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
              Adicionar
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = "";
              }}
            />
          </div>
        )}
      </CardHeader>
      <CardContent>
        {checkIn.photos.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma foto adicionada.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {checkIn.photos.map((p) => (
              <figure key={p.id} className="relative">
                <a href={p.url} target="_blank" rel="noopener noreferrer">
                  <img src={p.url} alt={p.caption || p.category_display} className="aspect-square w-full rounded-md border object-cover" />
                </a>
                <figcaption className="mt-1 text-xs text-muted-foreground">{p.category_display}</figcaption>
                {canEdit && (
                  <button
                    type="button"
                    onClick={async () => apply(await deleteGeneralPhoto(p.id))}
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                    aria-label="Remover foto"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </figure>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Checklist ---

function Checklist({ checkIn, apply, canEdit }: { checkIn: CheckIn; apply: (c: CheckIn) => void; canEdit: boolean }) {
  async function setStatus(itemId: number, status: ItemStatus) {
    apply(await setItems(checkIn.id, [{ id: itemId, status }]));
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Itens presentes no veículo</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {checkIn.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5">
            <span className="text-sm">{item.name}</span>
            {canEdit ? (
              <div className="flex gap-1">
                {ITEM_STATUS_ORDER.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatus(item.id, st)}
                    className={cn(
                      "rounded border px-1.5 py-0.5 text-xs",
                      item.status === st ? ITEM_STATUS[st].badge + " bg-accent" : "text-muted-foreground",
                    )}
                  >
                    {ITEM_STATUS[st].label}
                  </button>
                ))}
              </div>
            ) : (
              <Badge variant="outline" className={ITEM_STATUS[item.status].badge}>
                {ITEM_STATUS[item.status].label}
              </Badge>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// --- Objetos deixados ---

function Belongings({ checkIn, apply, canEdit }: { checkIn: CheckIn; apply: (c: CheckIn) => void; canEdit: boolean }) {
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!description.trim()) return;
    setSaving(true);
    try {
      apply(await addBelonging(checkIn.id, { description: description.trim(), location }));
      setDescription("");
      setLocation("");
    } catch (e) {
      toast.error(extractErrorMessage(e, "Não foi possível registrar o objeto."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Objetos deixados no interior</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {checkIn.belongings.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum objeto registrado.</p>
        ) : (
          <ul className="space-y-1">
            {checkIn.belongings.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm">
                <span>
                  {b.description}
                  {b.location && <span className="text-muted-foreground"> — {b.location}</span>}
                </span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={async () => apply(await deleteBelonging(b.id))}
                    className="text-destructive"
                    aria-label="Remover objeto"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input placeholder="Ex.: Mochila no banco traseiro" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Input className="sm:w-48" placeholder="Local (opcional)" value={location} onChange={(e) => setLocation(e.target.value)} />
            <Button variant="outline" disabled={saving || !description.trim()} onClick={add}>
              Adicionar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Dados gerais ---

function GeneralFields({ checkIn, apply, canEdit }: { checkIn: CheckIn; apply: (c: CheckIn) => void; canEdit: boolean }) {
  const [form, setForm] = useState({
    mileage: checkIn.mileage ?? "",
    fuel_level: checkIn.fuel_level,
    external_condition: checkIn.external_condition,
    internal_condition: checkIn.internal_condition,
    general_notes: checkIn.general_notes,
    arrived_driving: checkIn.arrived_driving,
    arrived_towed: checkIn.arrived_towed,
    customer_present: checkIn.customer_present,
    customer_confirmed: checkIn.customer_confirmed,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      mileage: checkIn.mileage ?? "",
      fuel_level: checkIn.fuel_level,
      external_condition: checkIn.external_condition,
      internal_condition: checkIn.internal_condition,
      general_notes: checkIn.general_notes,
      arrived_driving: checkIn.arrived_driving,
      arrived_towed: checkIn.arrived_towed,
      customer_present: checkIn.customer_present,
      customer_confirmed: checkIn.customer_confirmed,
    });
  }, [checkIn]);

  async function save() {
    setSaving(true);
    try {
      apply(
        await updateCheckIn(checkIn.id, {
          ...form,
          mileage: form.mileage === "" ? null : Number(form.mileage),
        } as Partial<CheckIn>),
      );
      toast.success("Check-in salvo com sucesso.");
    } catch (e) {
      toast.error(extractErrorMessage(e, "Não foi possível salvar."));
    } finally {
      setSaving(false);
    }
  }

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const toggles: { key: keyof typeof form; label: string }[] = [
    { key: "arrived_driving", label: "Chegou andando" },
    { key: "arrived_towed", label: "Chegou de guincho" },
    { key: "customer_present", label: "Cliente acompanhou" },
    { key: "customer_confirmed", label: "Cliente confirmou o check-in" },
  ];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Dados e observações do check-in</CardTitle>
        {canEdit && (
          <Button size="sm" disabled={saving} onClick={save}>
            {saving && <Loader2 className="size-4 animate-spin" />} Salvar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <fieldset disabled={!canEdit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ck-mileage">Quilometragem de entrada</Label>
              <Input
                id="ck-mileage"
                type="number"
                inputMode="numeric"
                value={form.mileage}
                onChange={(e) => set("mileage", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nível de combustível</Label>
              <Select value={form.fuel_level} onValueChange={(v) => set("fuel_level", v as typeof form.fuel_level)}>
                <SelectTrigger aria-label="Nível de combustível"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FUEL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {toggles.map((t) => (
              <label key={t.key} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                {t.label}
                <Switch
                  checked={Boolean(form[t.key])}
                  onCheckedChange={(v) => set(t.key, v as never)}
                  aria-label={t.label}
                />
              </label>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ck-notes">Observações gerais</Label>
            <Textarea
              id="ck-notes"
              value={form.general_notes}
              onChange={(e) => set("general_notes", e.target.value)}
              placeholder="Ex.: veículo chegou de guincho; luz de injeção acesa; cliente entregou apenas uma chave."
              className="min-h-20"
            />
          </div>
        </fieldset>
      </CardContent>
    </Card>
  );
}
