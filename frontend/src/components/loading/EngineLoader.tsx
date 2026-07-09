import { cn } from "@/lib/utils";

export type LoaderSize = "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<LoaderSize, number> = { sm: 18, md: 28, lg: 48, xl: 72 };

interface EngineLoaderProps {
  size?: LoaderSize;
  /** Texto para leitores de tela (sempre presente) e opcionalmente visível. */
  label?: string;
  /** Mostra o label ao lado da animação (além do texto acessível). */
  showLabel?: boolean;
  className?: string;
}

/**
 * Animação de pistões de um motor em V (CSS puro, sem dependências).
 *
 * Acessível: `role="status"` + `aria-busy` + texto `sr-only`; a animação é
 * `aria-hidden`. Respeita `prefers-reduced-motion` (ver index.css): sem
 * movimento, o motor fica estático. As cores vêm de `currentColor` (default
 * `text-primary`), então adapta a temas claro/escuro.
 */
export function EngineLoader({
  size = "md",
  label,
  showLabel = false,
  className,
}: EngineLoaderProps) {
  const px = SIZE_PX[size];
  const srText = label ?? "Carregando, aguarde.";
  return (
    <span
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn("inline-flex items-center gap-2 text-primary", className)}
    >
      <svg
        width={px}
        height={px}
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        {/* Cárter (base) */}
        <rect x="13" y="30" width="22" height="9" rx="3" fill="currentColor" opacity="0.18" />

        {/* Banco esquerdo do V */}
        <g transform="rotate(-27 24 33)">
          <rect x="18.5" y="9" width="11" height="22" rx="3.5" fill="currentColor" opacity="0.18" />
          <rect className="engine-piston" x="19.5" y="13" width="9" height="6" rx="2" fill="currentColor" />
          <rect x="23" y="19" width="2" height="12" rx="1" fill="currentColor" opacity="0.5" />
        </g>

        {/* Banco direito do V (pistão em oposição) */}
        <g transform="rotate(27 24 33)">
          <rect x="18.5" y="9" width="11" height="22" rx="3.5" fill="currentColor" opacity="0.18" />
          <rect
            className="engine-piston engine-piston--b"
            x="19.5"
            y="13"
            width="9"
            height="6"
            rx="2"
            fill="currentColor"
          />
          <rect x="23" y="19" width="2" height="12" rx="1" fill="currentColor" opacity="0.5" />
        </g>

        {/* Virabrequim: cubo + pino que gira */}
        <circle cx="24" cy="33" r="4.5" fill="currentColor" opacity="0.25" />
        <g className="engine-crank">
          <circle cx="24" cy="33" r="4.5" fill="none" />
          <circle cx="24" cy="30.5" r="1.6" fill="currentColor" />
        </g>
        <circle cx="24" cy="33" r="1.3" fill="currentColor" opacity="0.7" />
      </svg>

      {showLabel && label ? <span className="text-sm text-muted-foreground">{label}</span> : null}
      <span className="sr-only">{srText}</span>
    </span>
  );
}
