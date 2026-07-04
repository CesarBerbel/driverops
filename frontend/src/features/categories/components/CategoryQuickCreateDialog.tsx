import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import type { Category, CategoryType } from "../types";
import { CategoryForm } from "./CategoryForm";

interface CategoryQuickCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryType: CategoryType;
  onCreated: (category: Category) => void;
}

export function CategoryQuickCreateDialog({
  open,
  onOpenChange,
  categoryType,
  onCreated,
}: CategoryQuickCreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova categoria</DialogTitle>
        </DialogHeader>
        <CategoryForm
          category={null}
          categoryType={categoryType}
          onSuccess={(category) => {
            onOpenChange(false);
            onCreated(category);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
