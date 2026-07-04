import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { getWorkOrder } from "../api";
import { OrderForm } from "../components/OrderForm";
import { formatOrderNumber } from "../lib/orderMapping";

export function OrderEditorPage() {
  const navigate = useNavigate();
  const params = useParams();
  const orderId = params.id ? Number(params.id) : null;
  const isEditMode = orderId !== null;

  const { data: order } = useQuery({
    queryKey: ["work-orders", orderId],
    queryFn: () => getWorkOrder(orderId as number),
    enabled: isEditMode,
  });

  const isWaitingForData = isEditMode && !order;

  function goToList() {
    navigate("/orders");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="Voltar" onClick={goToList}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isEditMode
              ? order
                ? formatOrderNumber(order.number)
                : "Ordem de Serviço"
              : "Nova Ordem de Serviço"}
          </h1>
          <p className="text-muted-foreground">
            Identifique o veículo pela placa -- o cliente é preenchido automaticamente.
          </p>
        </div>
      </div>

      {isWaitingForData ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <OrderForm
          key={orderId ?? "create"}
          order={order ?? null}
          onSuccess={goToList}
          onCancel={goToList}
        />
      )}
    </div>
  );
}
