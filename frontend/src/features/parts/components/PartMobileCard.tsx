import { ArrowLeftRight, Layers, Package, Tag } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrencyBRL, formatQuantityBRL } from "@/lib/masks";

import { UNIT_OF_MEASURE_LABELS } from "../constants";
import type { Part } from "../types";

interface PartMobileCardProps {
  part: Part;
  // Ação principal: abre a peça para edição (a PartsPage usa um sheet/estado).
  onEdit?: (id: number) => void;
  // Ação rápida opcional: movimentar estoque (entrada/saída/ajuste).
  onMoveStock?: (part: Part) => void;
}

// Card mobile da peça: espelha a linha da tabela do desktop, destacando o
// estoque e o status de estoque baixo (o ponto de atenção operacional).
export function PartMobileCard({ part, onEdit, onMoveStock }: PartMobileCardProps) {
  const unit = UNIT_OF_MEASURE_LABELS[part.unit_of_measure];

  return (
    <Card>
      <CardContent className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          {onEdit ? (
            <button
              type="button"
              onClick={() => onEdit(part.id)}
              className="text-left text-sm font-semibold text-primary hover:underline focus-visible:underline focus-visible:outline-none"
            >
              {part.name}
            </button>
          ) : (
            <span className="text-sm font-semibold">{part.name}</span>
          )}
          {part.is_low_stock && <Badge variant="muted">Estoque baixo</Badge>}
        </div>

        {(part.internal_code || part.brand) && (
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {part.internal_code && (
              <span className="inline-flex items-center gap-1">
                <Tag className="size-3" />
                {part.internal_code}
              </span>
            )}
            {part.brand && <span>{part.brand}</span>}
          </p>
        )}

        {part.category_name && (
          <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Layers className="size-3" />
            {part.category_name}
          </p>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Package className="size-3" />
            Estoque: {formatQuantityBRL(Number(part.current_quantity))} {unit}
            {part.min_quantity !== null && (
              <> (mín. {formatQuantityBRL(Number(part.min_quantity))})</>
            )}
          </span>
          <span>Venda: {part.sale_price !== null ? formatCurrencyBRL(Number(part.sale_price)) : "—"}</span>
        </div>

        {(onEdit || onMoveStock) && (
          <div className="flex items-center gap-1.5 pt-1">
            {onEdit && (
              <Button size="sm" className="flex-1" onClick={() => onEdit(part.id)}>
                Editar
              </Button>
            )}
            {onMoveStock && (
              <Button
                size="sm"
                variant="outline"
                title="Movimentar estoque"
                aria-label="Movimentar estoque"
                onClick={() => onMoveStock(part)}
              >
                <ArrowLeftRight className="size-4" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
