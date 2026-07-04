import { useQuery } from "@tanstack/react-query";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

import { getPart } from "./api";
import { PartForm } from "./components/PartForm";

interface PartFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partId: number | null;
}

export function PartFormSheet({ open, onOpenChange, partId }: PartFormSheetProps) {
  const isEditMode = partId !== null;

  const { data: part } = useQuery({
    queryKey: ["parts", partId],
    queryFn: () => getPart(partId as number),
    enabled: isEditMode && open,
  });

  // Gate on the data itself, not `isLoading` -- see VehicleFormSheet for why:
  // isLoading can read false for one render right after `enabled` flips true.
  const isWaitingForData = isEditMode && !part;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>{isEditMode ? "Editar peça" : "Nova peça"}</SheetTitle>
          <SheetDescription>
            Nome, categoria, unidade de medida e quantidade atual são obrigatórios -- os demais
            dados podem ser completados depois.
          </SheetDescription>
        </SheetHeader>

        {isWaitingForData ? (
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <PartForm
            key={partId ?? "create"}
            part={part ?? null}
            allowAddAnother={!isEditMode}
            onSuccess={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
