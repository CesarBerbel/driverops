import { useQuery } from "@tanstack/react-query";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

import { getService } from "./api";
import { ServiceForm } from "./components/ServiceForm";

interface ServiceFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceId: number | null;
}

export function ServiceFormSheet({ open, onOpenChange, serviceId }: ServiceFormSheetProps) {
  const isEditMode = serviceId !== null;

  const { data: service } = useQuery({
    queryKey: ["services", serviceId],
    queryFn: () => getService(serviceId as number),
    enabled: isEditMode && open,
  });

  // Gate on the data itself, not `isLoading` -- see PartFormSheet for why.
  const isWaitingForData = isEditMode && !service;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>{isEditMode ? "Editar serviço" : "Novo serviço"}</SheetTitle>
          <SheetDescription>
            Nome, categoria e valor de mão de obra são obrigatórios -- as peças padrão e os demais
            dados são opcionais.
          </SheetDescription>
        </SheetHeader>

        {isWaitingForData ? (
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <ServiceForm
            key={serviceId ?? "create"}
            service={service ?? null}
            onSuccess={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
