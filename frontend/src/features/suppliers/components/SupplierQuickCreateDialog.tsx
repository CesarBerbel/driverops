import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import type { Supplier } from "../types";
import { SupplierForm } from "./SupplierForm";

interface SupplierQuickCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (supplier: Supplier) => void;
}

export function SupplierQuickCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: SupplierQuickCreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b p-6">
          <DialogTitle>Novo fornecedor</DialogTitle>
        </DialogHeader>
        <SupplierForm
          supplier={null}
          onSuccess={(supplier) => {
            onOpenChange(false);
            onCreated(supplier);
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
