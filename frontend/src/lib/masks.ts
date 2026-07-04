export function onlyDigits(value: string): string {
  return (value ?? "").replace(/\D/g, "");
}

export function formatPhone(digits: string): string {
  const value = onlyDigits(digits).slice(0, 11);
  if (value.length <= 2) return value.length ? `(${value}` : value;
  if (value.length <= 6) return `(${value.slice(0, 2)}) ${value.slice(2)}`;
  if (value.length <= 10) {
    // 10-digit landline: (00) 0000-0000
    return `(${value.slice(0, 2)}) ${value.slice(2, 6)}-${value.slice(6)}`;
  }
  // 11-digit mobile: (00) 00000-0000
  return `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
}

export function formatCPF(digits: string): string {
  const value = onlyDigits(digits).slice(0, 11);
  const parts = [value.slice(0, 3), value.slice(3, 6), value.slice(6, 9)].filter(Boolean);
  let result = parts.join(".");
  if (value.length > 9) result += `-${value.slice(9, 11)}`;
  return result;
}

export function formatCNPJ(digits: string): string {
  const value = onlyDigits(digits).slice(0, 14);
  let result = value.slice(0, 2);
  if (value.length > 2) result += `.${value.slice(2, 5)}`;
  if (value.length > 5) result += `.${value.slice(5, 8)}`;
  if (value.length > 8) result += `/${value.slice(8, 12)}`;
  if (value.length > 12) result += `-${value.slice(12, 14)}`;
  return result;
}

export function formatDocument(digits: string, type: "individual" | "company"): string {
  return type === "company" ? formatCNPJ(digits) : formatCPF(digits);
}

export function formatCEP(digits: string): string {
  const value = onlyDigits(digits).slice(0, 8);
  if (value.length <= 5) return value;
  return `${value.slice(0, 5)}-${value.slice(5)}`;
}

export function formatUF(value: string): string {
  return (value ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 2);
}

// --- Currency (BRL) ---

export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

// Tolerates "120,50", "R$ 120,50", "120.50", "1.234,56" -- pasted with or
// without the R$ prefix, with or without thousands separators.
export function parseCurrencyBRL(input: string): number | null {
  const cleaned = (input ?? "").replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return null;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized: string;
  if (lastComma > lastDot) normalized = cleaned.replace(/\./g, "").replace(",", ".");
  else if (lastDot > lastComma) normalized = cleaned.replace(/,/g, "");
  else normalized = cleaned;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

// Cents-shifting keystroke formatter used by CurrencyInput: takes the raw
// digits typed so far (already digits-only) and returns "R$ 0,00"-formatted text.
export function formatCentsAsBRL(digitsOnly: string): string {
  const cents = digitsOnly ? parseInt(digitsOnly, 10) : 0;
  return formatCurrencyBRL(cents / 100);
}

// --- Quantity (pt-BR grouping, comma decimal) ---

export function formatQuantityBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

// Tolerates digits + at most one comma; thousands dots are stripped as noise
// since users rarely type them while entering a quantity.
export function parseQuantityBRL(input: string): number | null {
  const cleaned = (input ?? "").replace(/[^\d,]/g, "");
  if (!cleaned) return null;
  const normalized = cleaned.replace(/\.(?=\d{3})/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

// --- NCM (Brazilian fiscal code, 8 digits, grouped XXXX.XX.XX) ---

export function normalizeNCM(value: string): string {
  return onlyDigits(value).slice(0, 8);
}

export function formatNCM(digits: string): string {
  const value = onlyDigits(digits).slice(0, 8);
  if (value.length <= 4) return value;
  if (value.length <= 6) return `${value.slice(0, 4)}.${value.slice(4)}`;
  return `${value.slice(0, 4)}.${value.slice(4, 6)}.${value.slice(6)}`;
}

// --- Percent (0-100, comma decimal) ---

// Tolerates digits + one comma; returns a plain number (0-100 not enforced
// here -- the form schema clamps/validates the range).
export function parsePercent(input: string): number | null {
  const cleaned = (input ?? "").replace(/[^\d,]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

// --- Duration (integer minutes -> friendly "1h 30min") ---

export function formatMinutes(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return "";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours && minutes) return `${hours}h ${minutes}min`;
  if (hours) return `${hours}h`;
  return `${minutes}min`;
}
