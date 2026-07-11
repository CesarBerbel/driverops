import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { Skeleton } from "@/components/ui/skeleton";

import { getWorkOrder } from "../api";
import { OrderForm } from "../components/OrderForm";
import { formatOrderNumber } from "../lib/orderMapping";

export function OrderEditorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const orderId = params.id ? Number(params.id) : null;
  const isEditMode = orderId !== null;

  const { data: order } = useQuery({
    queryKey: ["work-orders", orderId],
    queryFn: () => getWorkOrder(orderId as number),
    enabled: isEditMode,
  });

  const isWaitingForData = isEditMode && !order;

  function goBack() {
    // "Voltar" retorna para a página anterior real (Kanban, lista, dashboard,
    // Cliente 360...). Quando a OS foi aberta direto (deep link/refresh) não há
    // histórico interno de navegação -- aí caímos na lista de OS.
    if (location.key !== "default") {
      navigate(-1);
    } else {
      navigate("/orders");
    }
  }

  return (
    <div className="space-y-6">
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

      {isWaitingForData ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <OrderForm key={orderId ?? "create"} order={order ?? null} onCancel={goBack} />
      )}
    </div>
  );
}
