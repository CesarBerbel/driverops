import type { PartStatusFilter, UnitOfMeasure } from "./types";

export const UNIT_OF_MEASURE_OPTIONS: { value: UnitOfMeasure; label: string }[] = [
  { value: "unit", label: "Unidade" },
  { value: "pair", label: "Par" },
  { value: "kit", label: "Kit" },
  { value: "liter", label: "Litro" },
  { value: "milliliter", label: "Mililitro" },
  { value: "meter", label: "Metro" },
  { value: "centimeter", label: "Centímetro" },
  { value: "box", label: "Caixa" },
  { value: "pack", label: "Pacote" },
  { value: "set", label: "Jogo" },
  { value: "other", label: "Outro" },
];

export const UNIT_OF_MEASURE_LABELS: Record<UnitOfMeasure, string> = Object.fromEntries(
  UNIT_OF_MEASURE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<UnitOfMeasure, string>;

export const PART_STATUS_OPTIONS: { value: PartStatusFilter; label: string }[] = [
  { value: "active", label: "Peças habilitadas" },
  { value: "inactive", label: "Peças desabilitadas" },
  { value: "all", label: "Todas" },
];
