import { useQuery } from "@tanstack/react-query";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

import { getSupplier } from "./api";
import { SupplierForm } from "./components/SupplierForm";

interface SupplierFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierId: number | null;
}

export function SupplierFormSheet({ open, onOpenChange, supplierId }: SupplierFormSheetProps) {
  const isEditMode = supplierId !== null;

  const { data: supplier } = useQuery({
    queryKey: ["suppliers", supplierId],
    queryFn: () => getSupplier(supplierId as number),
    enabled: isEditMode && open,
  });

  // Gate on the data itself, not `isLoading` -- see CustomerFormSheet for why:
  // isLoading can read false for one render right after `enabled` flips true.
  const isWaitingForData = isEditMode && !supplier;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>{isEditMode ? "Editar fornecedor" : "Novo fornecedor"}</SheetTitle>
          <SheetDescription>
            Apenas o nome/razão social é obrigatório -- os demais dados podem ser completados
            depois.
          </SheetDescription>
        </SheetHeader>

        {isWaitingForData ? (
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <SupplierForm
            key={supplierId ?? "create"}
            supplier={supplier ?? null}
            allowAddAnother={!isEditMode}
            onSuccess={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
