import type { Key, ReactNode } from "react";

import { useIsMobile } from "@/lib/useIsMobile";

interface ResponsiveDataViewProps<T> {
  items: T[];
  getKey: (item: T) => Key;
  // Card mostrado no mobile (< lg).
  renderCard: (item: T) => ReactNode;
  // Tabela (ou qualquer conteúdo) mostrada no desktop/tablet grande (>= lg).
  table: ReactNode;
}

// Alterna entre TABELA (desktop) e LISTA DE CARDS (mobile) conforme o breakpoint.
// Renderiza só um dos dois (não ambos), evitando DOM duplicado e scroll
// horizontal de tabelas largas no celular.
export function ResponsiveDataView<T>({
  items,
  getKey,
  renderCard,
  table,
}: ResponsiveDataViewProps<T>) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <div className="space-y-3">
        {items.map((item) => (
          <div key={getKey(item)}>{renderCard(item)}</div>
        ))}
      </div>
    );
  }
  return <>{table}</>;
}
