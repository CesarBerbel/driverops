import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { extractErrorMessage } from "@/lib/api-client";

import { notifyCustomer } from "../api";

// Envio manual de e-mail ao cliente com o status atual da OS. Gate por
// permissão (orders.edit) fica a cargo de quem renderiza.
export function NotifyCustomerButton({ orderId }: { orderId: number }) {
  const queryClient = useQueryClient();

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
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      {mutation.isPending ? (
        <Loader2 className="animate-spin" />
      ) : (
        <Mail className="size-4" />
      )}
      Notificar cliente
    </Button>
  );
}
