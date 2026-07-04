import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import type { Service } from "../types";
import { ServiceForm } from "./ServiceForm";

interface ServiceQuickCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (service: Service) => void;
}

export function ServiceQuickCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: ServiceQuickCreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b p-6">
          <DialogTitle>Novo serviço</DialogTitle>
        </DialogHeader>
        <ServiceForm
          service={null}
          onSuccess={(service) => {
            onOpenChange(false);
            onCreated(service);
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
