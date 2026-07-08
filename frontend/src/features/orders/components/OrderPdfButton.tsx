import { FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { extractErrorMessage } from "@/lib/api-client";

import { openOrderPdf } from "../api";

// Abre o PDF da OS em nova aba. Gate por permissão fica a cargo de quem renderiza.
export function OrderPdfButton({ orderId }: { orderId: number }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await openOrderPdf(orderId);
    } catch (error) {
      toast.error(extractErrorMessage(error, "Não foi possível gerar o PDF da OS."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="outline" disabled={loading} onClick={handleClick}>
      {loading ? <Loader2 className="animate-spin" /> : <FileText className="size-4" />}
      PDF
    </Button>
  );
}
