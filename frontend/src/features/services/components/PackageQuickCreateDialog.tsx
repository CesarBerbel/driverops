import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import type { ServicePackage } from "../types";
import { PackageForm } from "./PackageForm";

interface PackageQuickCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (servicePackage: ServicePackage) => void;
}

export function PackageQuickCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: PackageQuickCreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b p-6">
          <DialogTitle>Novo pacote</DialogTitle>
        </DialogHeader>
        <PackageForm
          servicePackage={null}
          onSuccess={(servicePackage) => {
            onOpenChange(false);
            onCreated(servicePackage);
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
