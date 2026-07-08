import { FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { extractErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

import { openOrderPdf } from "../api";

interface OrderPdfButtonProps {
  orderId: number;
  // Variante somente ícone, para uso em cards/modais compactos.
  iconOnly?: boolean;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  // Evita que o clique atinja um elemento clicável ao redor (ex.: card da OS).
  stopPropagation?: boolean;
}

// Abre o PDF da OS em nova aba. Gate por permissão fica a cargo de quem renderiza.
export function OrderPdfButton({
  orderId,
  iconOnly = false,
  variant = "outline",
  size,
  className,
  stopPropagation = false,
}: OrderPdfButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick(event: React.MouseEvent) {
    if (stopPropagation) event.stopPropagation();
    setLoading(true);
    try {
      await openOrderPdf(orderId);
    } catch (error) {
      toast.error(extractErrorMessage(error, "Não foi possível gerar o PDF da OS."));
    } finally {
      setLoading(false);
    }
  }

  const icon = loading ? <Loader2 className="animate-spin" /> : <FileText className="size-4" />;

  return (
    <Button
      type="button"
      variant={variant}
      size={size ?? (iconOnly ? "icon" : "default")}
      disabled={loading}
      onClick={handleClick}
      aria-label={iconOnly ? "Gerar PDF da OS" : undefined}
      title={iconOnly ? "Gerar PDF da OS" : undefined}
      className={cn(className)}
    >
      {icon}
      {!iconOnly && "PDF"}
    </Button>
  );
}
