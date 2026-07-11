import { useEffect, useMemo, useState } from "react";

import { SmartSearchDialog } from "./components/SmartSearchDialog";
import { SmartSearchContext, type SmartSearchContextValue } from "./smart-search-context";

export function SmartSearchProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  // Atalho global ⌘K / Ctrl+K para abrir/fechar a Busca Inteligente.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = useMemo<SmartSearchContextValue>(
    () => ({
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen((prev) => !prev),
    }),
    [isOpen],
  );

  return (
    <SmartSearchContext.Provider value={value}>
      {children}
      <SmartSearchDialog open={isOpen} onOpenChange={setIsOpen} />
    </SmartSearchContext.Provider>
  );
}
