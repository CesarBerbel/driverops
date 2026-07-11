import { createContext, useContext } from "react";

export interface SmartSearchContextValue {
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: boolean;
}

export const SmartSearchContext = createContext<SmartSearchContextValue | null>(null);

export function useSmartSearch(): SmartSearchContextValue {
  const ctx = useContext(SmartSearchContext);
  if (!ctx) {
    throw new Error("useSmartSearch deve ser usado dentro de SmartSearchProvider");
  }
  return ctx;
}
