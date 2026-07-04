import { useQuery } from "@tanstack/react-query";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

import { getServicePackage } from "./api";
import { PackageForm } from "./components/PackageForm";

interface PackageFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packageId: number | null;
}

export function PackageFormSheet({ open, onOpenChange, packageId }: PackageFormSheetProps) {
  const isEditMode = packageId !== null;

  const { data: servicePackage } = useQuery({
    queryKey: ["service-packages", packageId],
    queryFn: () => getServicePackage(packageId as number),
    enabled: isEditMode && open,
  });

  const isWaitingForData = isEditMode && !servicePackage;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>{isEditMode ? "Editar pacote" : "Novo pacote"}</SheetTitle>
          <SheetDescription>
            O pacote precisa de um nome e de ao menos um serviço vinculado. O valor final é
            calculado automaticamente.
          </SheetDescription>
        </SheetHeader>

        {isWaitingForData ? (
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <PackageForm
            key={packageId ?? "create"}
            servicePackage={servicePackage ?? null}
            allowAddAnother={!isEditMode}
            onSuccess={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
