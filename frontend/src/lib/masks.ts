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
