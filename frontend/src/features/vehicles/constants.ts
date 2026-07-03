import type { FuelType, Steering, Transmission, UsageCategory, VehicleType } from "./types";

// Radix Select can't use an empty string as an item value, so every
// optional select uses this sentinel for "não informado" and the form
// converts it to/from "" (frontend) / null-or-blank (backend) at the
// submit/hydrate boundary.
export const UNSPECIFIED = "unspecified";

export const FUEL_TYPE_OPTIONS: { value: FuelType; label: string }[] = [
  { value: "gasoline", label: "Gasolina" },
  { value: "ethanol", label: "Etanol" },
  { value: "flex", label: "Flex" },
  { value: "diesel", label: "Diesel" },
  { value: "hybrid", label: "Híbrido" },
  { value: "electric", label: "Elétrico" },
  { value: "cng", label: "GNV" },
  { value: "other", label: "Outro" },
];

export const TRANSMISSION_OPTIONS: { value: Transmission; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "automatic", label: "Automático" },
  { value: "automated", label: "Automatizado" },
  { value: "cvt", label: "CVT" },
  { value: "other", label: "Outro" },
];

export const STEERING_OPTIONS: { value: Steering; label: string }[] = [
  { value: "mechanical", label: "Mecânica" },
  { value: "hydraulic", label: "Hidráulica" },
  { value: "electric", label: "Elétrica" },
  { value: "electrohydraulic", label: "Eletro-hidráulica" },
  { value: "other", label: "Outra" },
];

export const VEHICLE_TYPE_OPTIONS: { value: VehicleType; label: string }[] = [
  { value: "car", label: "Carro" },
  { value: "motorcycle", label: "Moto" },
  { value: "pickup", label: "Caminhonete" },
  { value: "van", label: "Van" },
  { value: "truck", label: "Caminhão" },
  { value: "utility", label: "Utilitário" },
  { value: "other", label: "Outro" },
];

export const USAGE_CATEGORY_OPTIONS: { value: UsageCategory; label: string }[] = [
  { value: "private", label: "Particular" },
  { value: "commercial", label: "Comercial" },
  { value: "ride_hailing", label: "Aplicativo" },
  { value: "taxi", label: "Táxi" },
  { value: "fleet", label: "Frota" },
  { value: "other", label: "Outro" },
];

export const DOORS_OPTIONS = [2, 3, 4, 5];

export const TRI_STATE_OPTIONS = [
  { value: "true", label: "Sim" },
  { value: "false", label: "Não" },
];

export const VEHICLE_STATUS_OPTIONS: { value: "active" | "inactive" | "all"; label: string }[] = [
  { value: "active", label: "Veículos ativos" },
  { value: "inactive", label: "Veículos desabilitados" },
  { value: "all", label: "Todos" },
];
