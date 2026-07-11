import { createContext, useContext } from "react";

// Tema da aplicação. "system" segue a preferência do sistema operacional.
export type Theme = "light" | "dark" | "system";

export interface ThemeContextValue {
  theme: Theme;
  // O tema efetivamente aplicado (resolve "system" para light/dark).
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

// Fora de um <ThemeProvider> (ex.: testes que renderizam um componente isolado)
// devolvemos um default inerte em vez de lançar erro -- assim primitivos de UI
// como o <Toaster> nunca quebram por falta de provider.
const DEFAULT: ThemeContextValue = {
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => {},
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext) ?? DEFAULT;
}
