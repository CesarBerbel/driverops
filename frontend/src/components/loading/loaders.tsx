import { AlertCircle, Inbox, Lock } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { EngineLoader, type LoaderSize } from "./EngineLoader";

/** Loader de página: ocupa a área de conteúdo, centralizado, com mensagem. */
export function PageLoader({
  label = "Carregando informações...",
  size = "lg",
  className,
}: {
  label?: string;
  size?: LoaderSize;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-60 w-full flex-col items-center justify-center gap-3 py-10 text-center",
        className,
      )}
    >
      <EngineLoader size={size} />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

/** Loader inline: compacto, para cards/listas/áreas pequenas. */
export function InlineLoader({
  label,
  size = "sm",
  className,
}: {
  label?: string;
  size?: LoaderSize;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-muted-foreground", className)}>
      <EngineLoader size={size} label={label} showLabel={Boolean(label)} />
    </span>
  );
}

/** Loader de botão: engine pequeno + texto, para usar dentro de <Button>. */
export function ButtonLoader({ label = "Processando..." }: { label?: string }) {
  return <EngineLoader size="sm" label={label} showLabel className="text-current" />;
}

/**
 * Overlay de processamento: cobre o container (posicione o pai como `relative`)
 * e impede cliques enquanto `active`. Use para ações longas/críticas (gerar
 * orçamento/PDF, upload). Com `fullscreen`, cobre a viewport inteira.
 */
export function LoadingOverlay({
  active,
  label = "Processando...",
  fullscreen = false,
}: {
  active: boolean;
  label?: string;
  fullscreen?: boolean;
}) {
  if (!active) return null;
  return (
    <div
      aria-busy="true"
      className={cn(
        "z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm",
        fullscreen ? "fixed inset-0" : "absolute inset-0",
      )}
    >
      <div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-6 shadow-lg">
        <EngineLoader size="lg" label={label} />
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/**
 * Padroniza os estados de uma área: carregando / erro / vazio / sem permissão.
 * Quando nenhum estado está ativo, renderiza `children`.
 */
export function LoadingState({
  isLoading,
  isError,
  isEmpty,
  isForbidden,
  loadingLabel = "Carregando dados...",
  errorLabel = "Não foi possível carregar os dados. Tente novamente.",
  emptyLabel = "Nenhum registro encontrado.",
  forbiddenLabel = "Você não tem permissão para ver esta área.",
  onRetry,
  size = "lg",
  children,
}: {
  isLoading?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  isForbidden?: boolean;
  loadingLabel?: string;
  errorLabel?: string;
  emptyLabel?: string;
  forbiddenLabel?: string;
  onRetry?: () => void;
  size?: LoaderSize;
  children?: ReactNode;
}) {
  if (isLoading) return <PageLoader label={loadingLabel} size={size} />;

  if (isForbidden) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-2 py-8 text-center text-muted-foreground">
        <Lock className="size-7 opacity-60" />
        <p className="text-sm">{forbiddenLabel}</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-3 py-8 text-center">
        <AlertCircle className="size-7 text-destructive" />
        <p className="text-sm text-muted-foreground">{errorLabel}</p>
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            Tentar novamente
          </Button>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-2 py-8 text-center text-muted-foreground">
        <Inbox className="size-7 opacity-60" />
        <p className="text-sm">{emptyLabel}</p>
      </div>
    );
  }

  return <>{children}</>;
}
