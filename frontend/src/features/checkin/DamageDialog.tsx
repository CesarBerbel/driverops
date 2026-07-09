import { Camera, Loader2, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { extractErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

import {
  addDamagePhoto,
  createDamage,
  deleteDamage,
  deleteDamagePhoto,
  updateDamage,
} from "./api";
import { DAMAGE_TYPE_OPTIONS, REGION_OPTIONS, SEVERITY, SEVERITY_OPTIONS } from "./constants";
import type { CheckIn, Damage, Severity } from "./types";

interface DamageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkInId: number;
  damage: Damage | null;
  coords: { x: number; y: number } | null;
  canEdit: boolean;
  onChanged: (checkIn: CheckIn) => void;
}

export function DamageDialog({
  open,
  onOpenChange,
  checkInId,
  damage,
  coords,
  canEdit,
  onChanged,
}: DamageDialogProps) {
  // A avaria "atual": a existente ou a recém-criada (para anexar fotos sem fechar).
  const [current, setCurrent] = useState<Damage | null>(damage);
  const [region, setRegion] = useState("other");
  const [damageType, setDamageType] = useState("other");
  const [severity, setSeverity] = useState<Severity>("light");
  const [description, setDescription] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setCurrent(damage);
    setRegion(damage?.region ?? "other");
    setDamageType(damage?.damage_type ?? "other");
    setSeverity(damage?.severity ?? "light");
    setDescription(damage?.description ?? "");
    setInternalNotes(damage?.internal_notes ?? "");
  }, [open, damage]);

  async function handleSave() {
    if (!description.trim()) {
      toast.error("Descreva a avaria identificada.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        region,
        damage_type: damageType,
        severity,
        description: description.trim(),
        internal_notes: internalNotes,
      };
      let checkIn: CheckIn;
      if (current) {
        checkIn = await updateDamage(current.id, payload);
        setCurrent(checkIn.damages.find((d) => d.id === current.id) ?? null);
        toast.success("Avaria atualizada.");
      } else {
        checkIn = await createDamage({
          check_in: checkInId,
          x: coords?.x,
          y: coords?.y,
          ...payload,
        });
        // Seleciona a recém-criada (maior sequência) para permitir anexar fotos.
        const created = [...checkIn.damages].sort((a, b) => b.sequence - a.sequence)[0] ?? null;
        setCurrent(created);
        toast.success("Avaria registrada.");
      }
      onChanged(checkIn);
    } catch (error) {
      toast.error(extractErrorMessage(error, "Não foi possível salvar a avaria."));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(file: File) {
    if (!current) return;
    setUploading(true);
    try {
      const checkIn = await addDamagePhoto(current.id, file);
      setCurrent(checkIn.damages.find((d) => d.id === current.id) ?? current);
      onChanged(checkIn);
    } catch (error) {
      toast.error(extractErrorMessage(error, "Falha no upload da foto."));
    } finally {
      setUploading(false);
    }
  }

  async function handleRemovePhoto(photoId: number) {
    if (!current) return;
    try {
      const checkIn = await deleteDamagePhoto(photoId);
      setCurrent(checkIn.damages.find((d) => d.id === current.id) ?? current);
      onChanged(checkIn);
    } catch (error) {
      toast.error(extractErrorMessage(error, "Não foi possível remover a foto."));
    }
  }

  async function handleRemoveDamage() {
    if (!current) return;
    try {
      const checkIn = await deleteDamage(current.id);
      onChanged(checkIn);
      setConfirmRemove(false);
      onOpenChange(false);
      toast.success("Avaria removida.");
    } catch (error) {
      toast.error(extractErrorMessage(error, "Não foi possível remover a avaria."));
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {current ? `Avaria #${current.sequence}` : "Nova avaria"}
          </SheetTitle>
          <SheetDescription>
            Descreva apenas o que foi identificado visualmente no check-in. Não registre
            diagnósticos técnicos aqui.
          </SheetDescription>
        </SheetHeader>

        <fieldset disabled={!canEdit} className="space-y-4 px-4 pb-4">
          <div className="space-y-1.5">
            <Label>Severidade *</Label>
            <div className="flex gap-2">
              {SEVERITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSeverity(opt.value)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-sm",
                    severity === opt.value ? "border-primary bg-accent" : "border-input",
                  )}
                >
                  <span className={cn("size-3 rounded-full", SEVERITY[opt.value].dot)} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Região</Label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger aria-label="Região do veículo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REGION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={damageType} onValueChange={setDamageType}>
                <SelectTrigger aria-label="Tipo de avaria">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAMAGE_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dmg-desc">Descrição *</Label>
            <Textarea
              id="dmg-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Risco na porta dianteira esquerda"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dmg-notes">Observação interna (opcional)</Label>
            <Textarea
              id="dmg-notes"
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              className="min-h-16"
            />
          </div>

          {canEdit && (
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {current ? "Salvar avaria" : "Registrar avaria"}
            </Button>
          )}

          {/* Fotos (só depois que a avaria existe) */}
          {current && (
            <div className="space-y-2">
              <Label>Fotos da avaria</Label>
              <div className="flex flex-wrap gap-2">
                {current.photos.map((p) => (
                  <div key={p.id} className="relative">
                    <img
                      src={p.url}
                      alt={p.caption || "Foto da avaria"}
                      className="size-20 rounded-md border object-cover"
                    />
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(p.id)}
                        className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                        aria-label="Remover foto"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </div>
                ))}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex size-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs text-muted-foreground hover:bg-accent"
                  >
                    {uploading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Camera className="size-4" />
                    )}
                    Foto
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                  e.target.value = "";
                }}
              />
            </div>
          )}

          {canEdit && current && (
            <Button
              variant="ghost"
              className="w-full text-destructive hover:text-destructive"
              onClick={() => setConfirmRemove(true)}
            >
              <Trash2 className="size-4" /> Remover avaria
            </Button>
          )}
        </fieldset>
      </SheetContent>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover avaria?</AlertDialogTitle>
            <AlertDialogDescription>
              A marcação e as fotos vinculadas serão removidas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveDamage}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
