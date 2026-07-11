import { useMediaQuery } from "./useMediaQuery";

// Mobile/tablet pequeno = abaixo do breakpoint `lg` (1024px). A partir de `lg`
// mantemos o layout desktop (menu completo). Ver AppShell.
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 1023px)");
}
