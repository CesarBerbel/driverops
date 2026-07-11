import { SlidersHorizontal } from "lucide-react";
import { type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface MobileFilterSheetProps {
  // Nº de filtros ativos (mostrado no botão como badge).
  activeCount?: number;
  onClear?: () => void;
  children: ReactNode;
  triggerClassName?: string;
}

// Botão "Filtros" que abre um bottom sheet com os controles de filtro (children).
// Mostra um contador de filtros ativos e permite limpar tudo. Feito para o
// mobile: a página esconde os filtros inline (lg) e usa isto abaixo de lg.
export function MobileFilterSheet({
  activeCount = 0,
  onClear,
  children,
  triggerClassName,
}: MobileFilterSheetProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn("shrink-0", triggerClassName)}
        aria-label="Filtros"
      >
        <SlidersHorizontal className="size-4" />
        Filtros
        {activeCount > 0 && (
          <span className="ml-1 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground">
            {activeCount}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85svh] overflow-y-auto rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <SheetHeader>
            <SheetTitle>Filtros</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-4">{children}</div>
          <div className="flex items-center gap-2 px-4">
            {onClear && (
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  onClear();
                  setOpen(false);
                }}
              >
                Limpar filtros
              </Button>
            )}
            <Button type="button" className="flex-1" onClick={() => setOpen(false)}>
              Aplicar
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
