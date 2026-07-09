import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { EngineLoader, type LoaderSize } from "./EngineLoader";
import { ButtonLoader, LoadingOverlay, PageLoader } from "./loaders";
import { CardSkeleton, TableSkeleton } from "./skeletons";

const SIZES: LoaderSize[] = ["sm", "md", "lg", "xl"];

/**
 * Ferramenta de desenvolvimento para pré-visualizar os estados de espera (em
 * dev tudo carrega rápido demais para ver a animação). Renderizada apenas
 * quando `import.meta.env.DEV` é verdadeiro -- não vai para produção.
 */
export function LoaderPlayground() {
  const [overlay, setOverlay] = useState(false);
  const [page, setPage] = useState(false);
  const [saving, setSaving] = useState(false);

  function run(setter: (v: boolean) => void, ms = 3000) {
    setter(true);
    setTimeout(() => setter(false), ms);
  }

  return (
    <Card className="relative border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <EngineLoader size="sm" />
          Testar estados de espera{" "}
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
            dev
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Disparadores de espera (3s) */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => run(setOverlay)}>
            Overlay (3s)
          </Button>
          <Button size="sm" variant="outline" onClick={() => run(setPage)}>
            Página (3s)
          </Button>
          <Button size="sm" variant="outline" disabled={saving} onClick={() => run(setSaving)}>
            {saving ? <ButtonLoader label="Salvando..." /> : "Botão salvar (3s)"}
          </Button>
        </div>

        {page ? (
          <PageLoader label="Carregando dados da oficina..." />
        ) : (
          <>
            {/* Galeria dos tamanhos (sempre animando) */}
            <div>
              <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Tamanhos</p>
              <div className="flex items-end gap-6">
                {SIZES.map((size) => (
                  <div key={size} className="flex flex-col items-center gap-1">
                    <EngineLoader size={size} />
                    <span className="text-xs text-muted-foreground">{size}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Skeletons */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                  CardSkeleton
                </p>
                <CardSkeleton />
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                  TableSkeleton
                </p>
                <TableSkeleton rows={3} columns={3} />
              </div>
            </div>
          </>
        )}
      </CardContent>

      <LoadingOverlay active={overlay} label="Processando... (exemplo de espera)" fullscreen />
    </Card>
  );
}
