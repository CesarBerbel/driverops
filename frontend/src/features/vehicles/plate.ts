const OLD_PLATE_RE = /^[A-Z]{3}[0-9]{4}$/;
const MERCOSUL_PLATE_RE = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;

// Typing-time transform: uppercase, strip anything but letters/digits, cap
// at 7 characters. No punctuation is auto-inserted -- the old format
// (ABC1234) and Mercosul format (ABC1D23) diverge at character 5 (digit vs
// letter), so guessing which separator to show mid-typing would often be
// wrong. Separators are stripped either way before this is ever submitted.
export function normalizePlate(value: string): string {
  return (value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 7);
}

export function isValidPlate(plate: string): boolean {
  return OLD_PLATE_RE.test(plate) || MERCOSUL_PLATE_RE.test(plate);
}

// Read-only display: once the plate is known-valid, the old format reads
// better with its conventional hyphen (ABC-1234). Mercosul plates are shown
// as-is (ABC1D23), matching their real-world convention of no separator.
export function formatPlateForDisplay(plate: string): string {
  if (OLD_PLATE_RE.test(plate)) {
    return `${plate.slice(0, 3)}-${plate.slice(3)}`;
  }
  return plate;
}
