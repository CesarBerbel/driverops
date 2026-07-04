import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import type { Part } from "../types";
import { PartForm } from "./PartForm";

interface PartQuickCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (part: Part) => void;
}

export function PartQuickCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: PartQuickCreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b p-6">
          <DialogTitle>Nova peça</DialogTitle>
        </DialogHeader>
        <PartForm
          part={null}
          onSuccess={(part) => {
            onOpenChange(false);
            onCreated(part);
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
