import { onlyDigits } from "@/lib/masks";

// Brazil-only, matching the rest of the app's assumptions (CPF/CNPJ, CEP,
// UF, default country "Brasil"). Numbers are stored digits-only without a
// country code, so it's prefixed here when building the click-to-chat link.
const BRAZIL_COUNTRY_CODE = "55";

export function buildWhatsAppUrl(phone: string): string {
  const digits = onlyDigits(phone);
  return `https://wa.me/${BRAZIL_COUNTRY_CODE}${digits}`;
}
