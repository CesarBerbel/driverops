import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { extractErrorMessage } from "@/lib/api-client";

import { notifyCustomer } from "../api";

// Envio manual de e-mail ao cliente com o status atual da OS. Gate por
// permissão (orders.edit) fica a cargo de quem renderiza. No modo iconOnly
// (mobile) mostra só o ícone, com o rótulo no title/aria-label (tooltip).
export function NotifyCustomerButton({
  orderId,
  iconOnly = false,
}: {
  orderId: number;
  iconOnly?: boolean;
}) {
  const queryClient = useQueryClient();
  const label = "Notificar cliente";

  const mutation = useMutation({
    mutationFn: () => notifyCustomer(orderId),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: ["work-orders", orderId, "events"],
      });
      toast.success(`E-mail enviado ao cliente (${result.email}).`);
    },
    onError: (error) =>
      toast.error(
        extractErrorMessage(error, "Não foi possível notificar o cliente."),
      ),
  });

  return (
    <Button
      type="button"
      variant="outline"
      size={iconOnly ? "icon" : "default"}
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
      title={iconOnly ? label : undefined}
      aria-label={iconOnly ? label : undefined}
    >
      {mutation.isPending ? (
        <Loader2 className="animate-spin" />
      ) : (
        <Mail className="size-4" />
      )}
      {!iconOnly && label}
    </Button>
  );
}
