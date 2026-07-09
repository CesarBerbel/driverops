import type { ItemStatus, Severity } from "./types";

export const SEVERITY: Record<
  Severity,
  { label: string; dot: string; badge: string; ring: string }
> = {
  light: {
    label: "Leve",
    dot: "bg-emerald-500",
    badge: "border-emerald-400 text-emerald-700 dark:text-emerald-400",
    ring: "ring-emerald-500",
  },
  medium: {
    label: "Média",
    dot: "bg-amber-500",
    badge: "border-amber-400 text-amber-700 dark:text-amber-400",
    ring: "ring-amber-500",
  },
  severe: {
    label: "Grave",
    dot: "bg-red-500",
    badge: "border-red-400 text-red-700 dark:text-red-400",
    ring: "ring-red-500",
  },
};

export const SEVERITY_OPTIONS: { value: Severity; label: string }[] = [
  { value: "light", label: "Leve" },
  { value: "medium", label: "Média" },
  { value: "severe", label: "Grave" },
];

export const REGION_OPTIONS = [
  { value: "front", label: "Frente" },
  { value: "hood", label: "Capô" },
  { value: "windshield", label: "Para-brisa" },
  { value: "roof", label: "Teto" },
  { value: "front_left_door", label: "Porta dianteira esquerda" },
  { value: "rear_left_door", label: "Porta traseira esquerda" },
  { value: "left_side", label: "Lateral esquerda" },
  { value: "front_right_door", label: "Porta dianteira direita" },
  { value: "rear_right_door", label: "Porta traseira direita" },
  { value: "right_side", label: "Lateral direita" },
  { value: "trunk", label: "Porta-malas" },
  { value: "front_bumper", label: "Para-choque dianteiro" },
  { value: "rear_bumper", label: "Para-choque traseiro" },
  { value: "wheels", label: "Rodas" },
  { value: "mirrors", label: "Retrovisores" },
  { value: "headlights", label: "Faróis" },
  { value: "taillights", label: "Lanternas" },
  { value: "interior", label: "Interior" },
  { value: "other", label: "Outro" },
];

export const DAMAGE_TYPE_OPTIONS = [
  { value: "scratch", label: "Risco" },
  { value: "dent", label: "Amassado" },
  { value: "broken", label: "Quebrado" },
  { value: "cracked", label: "Trincado" },
  { value: "missing_part", label: "Peça faltando" },
  { value: "paint", label: "Pintura danificada" },
  { value: "glass", label: "Vidro danificado" },
  { value: "light", label: "Farol/lanterna danificado" },
  { value: "tire", label: "Pneu/roda danificado" },
  { value: "mirror", label: "Retrovisor danificado" },
  { value: "interior", label: "Interior danificado" },
  { value: "stain", label: "Sujeira/mancha" },
  { value: "other", label: "Outro" },
];

export const PHOTO_CATEGORY_OPTIONS = [
  { value: "front", label: "Frente" },
  { value: "rear", label: "Traseira" },
  { value: "left", label: "Lateral esquerda" },
  { value: "right", label: "Lateral direita" },
  { value: "interior", label: "Interior" },
  { value: "dashboard", label: "Painel" },
  { value: "trunk", label: "Porta-malas" },
  { value: "engine", label: "Motor" },
  { value: "odometer", label: "Quilometragem/painel" },
  { value: "document", label: "Documento/placa" },
  { value: "other", label: "Outras" },
];

export const FUEL_OPTIONS = [
  { value: "not_checked", label: "Não verificado" },
  { value: "reserve", label: "Reserva" },
  { value: "quarter", label: "1/4" },
  { value: "half", label: "1/2" },
  { value: "three_quarters", label: "3/4" },
  { value: "full", label: "Cheio" },
];

export const ITEM_STATUS: Record<ItemStatus, { label: string; badge: string }> = {
  present: { label: "Presente", badge: "border-emerald-400 text-emerald-700 dark:text-emerald-400" },
  absent: { label: "Ausente", badge: "border-red-400 text-red-700 dark:text-red-400" },
  na: { label: "Não se aplica", badge: "border-slate-300 text-muted-foreground" },
  unchecked: { label: "Não verificado", badge: "border-amber-300 text-amber-700 dark:text-amber-400" },
};

export const ITEM_STATUS_ORDER: ItemStatus[] = ["present", "absent", "na", "unchecked"];
