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
import { QuoteItemDecisionList } from "./QuoteItemDecisionList";
import { approvedTotal } from "./quoteTotals";
import { SignaturePad } from "./SignaturePad";

interface TabletSignatureDialogProps {
  quote: Quote | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (clientName: string, signature: string, approvedIds: number[]) => void;
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
  const [approvedIds, setApprovedIds] = useState<number[]>([]);

  useEffect(() => {
    if (open && quote) {
      setClientName(quote.customer_name ?? "");
      setSignature(null);
      // Todos aprovados por padrão; o cliente desmarca o que não quer.
      setApprovedIds(quote.items.map((item) => item.id));
    }
  }, [open, quote]);

  const canConfirm = clientName.trim().length > 0 && signature !== null;
  const approvedValue = quote ? approvedTotal(quote.items, approvedIds) : 0;

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
            <QuoteItemDecisionList
              items={quote.items}
              approvedIds={approvedIds}
              onChange={setApprovedIds}
            />

            <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3 text-sm">
              <span className="text-muted-foreground">Valor final aprovado</span>
              <span className="text-base font-semibold">
                {formatCurrencyBRL(approvedValue)}
              </span>
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
              execução <strong>apenas dos itens aprovados</strong>.
            </p>
          </div>
        )}

        <DialogFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!canConfirm || isPending}
            onClick={() =>
              onConfirm(clientName.trim(), signature as string, approvedIds)
            }
          >
            Confirmar aprovação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
