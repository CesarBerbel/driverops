import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/lib/useIsMobile";

import { SmartSearchPanel } from "./SmartSearchPanel";

// Busca Inteligente: Dialog no desktop, bottom sheet no mobile (campo grande e
// fácil de tocar). O título fica acessível a leitores de tela (sr-only).
export function SmartSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isMobile = useIsMobile();
  const close = () => onOpenChange(false);

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[90svh] gap-0 rounded-t-2xl p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Busca Inteligente</SheetTitle>
          </SheetHeader>
          <SmartSearchPanel onClose={close} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Busca Inteligente</DialogTitle>
        </DialogHeader>
        <SmartSearchPanel onClose={close} />
      </DialogContent>
    </Dialog>
  );
}
