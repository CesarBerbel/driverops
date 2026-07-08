import { Braces } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { VariableGroup } from "../types";

interface VariablePaletteProps {
  groups: VariableGroup[];
  onInsert: (key: string) => void;
  disabled?: boolean;
}

/**
 * Paleta de variáveis agrupadas por categoria. Cada variável mostra o rótulo
 * legível, a chave técnica e um exemplo (via title). Clicar insere {{chave}} no
 * ponto atual do editor -- o usuário não precisa decorar nomes internos.
 */
export function VariablePalette({ groups, onInsert, disabled }: VariablePaletteProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Braces className="size-4 text-primary" />
          Variáveis disponíveis
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Clique numa variável para inseri-la no campo em foco.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {groups.map((group) => (
          <div key={group.key} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {group.variables.map((variable) => (
                <Button
                  key={variable.key}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  title={`{{${variable.key}}} — ex.: ${variable.example}`}
                  aria-label={`Inserir ${variable.label}`}
                  className="h-auto flex-col items-start gap-0 px-2 py-1 text-left"
                  onClick={() => onInsert(variable.key)}
                >
                  <span className="text-xs font-medium">{variable.label}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {`{{${variable.key}}}`}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
