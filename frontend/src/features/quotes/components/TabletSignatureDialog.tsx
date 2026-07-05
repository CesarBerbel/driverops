import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrencyBRL } from "@/lib/masks";

import type { Quote } from "../types";
import { SignaturePad } from "./SignaturePad";

interface TabletSignatureDialogProps {
  quote: Quote | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (clientName: string, signature: string) => void;
  isPending: boolean;
}

export function TabletSignatureDialog({
  quote,
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: TabletSignatureDialogProps) {
  const [clientName, setClientName] = useState("");
  const [signature, setSignature] = useState<string | null>(null);

  useEffect(() => {
    if (open && quote) {
      setClientName(quote.customer_name ?? "");
      setSignature(null);
    }
  }, [open, quote]);

  const canConfirm = clientName.trim().length > 0 && signature !== null;

  return (
    <Dialog open={open && quote !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Aprovação presencial no tablet</DialogTitle>
          <DialogDescription>
            Revise o resumo, informe o nome e assine no campo abaixo para autorizar a
            execução dos serviços.
          </DialogDescription>
        </DialogHeader>

        {quote && (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Orçamento {String(quote.number).padStart(4, "0")} · v{quote.version}
                </span>
                <span className="font-semibold">
                  {formatCurrencyBRL(Number(quote.totals.final_value))}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tablet-client-name">Nome do cliente</Label>
              <Input
                id="tablet-client-name"
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                placeholder="Nome de quem está assinando"
              />
            </div>

            <div className="space-y-1">
              <Label>Assinatura do cliente</Label>
              <SignaturePad onChange={setSignature} />
            </div>

            <p className="text-xs text-muted-foreground">
              Ao confirmar, o cliente declara que revisou o orçamento e autoriza a
              execução dos serviços descritos.
            </p>
          </div>
        )}

        <DialogFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!canConfirm || isPending}
            onClick={() => onConfirm(clientName.trim(), signature as string)}
          >
            Confirmar aprovação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
