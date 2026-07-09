import { useRef } from "react";

import { cn } from "@/lib/utils";

import { SEVERITY } from "./constants";
import type { Damage } from "./types";

interface CarMapProps {
  damages: Damage[];
  selectedId: number | null;
  onAdd: (x: number, y: number) => void;
  onSelect: (damage: Damage) => void;
  readOnly?: boolean;
}

/**
 * Desenho do veículo visto de cima (SVG). Clicar no carro adiciona uma marcação
 * de avaria em coordenadas relativas (% X/Y), que ficam corretas em qualquer
 * tamanho de tela. As bolinhas são numeradas e coloridas por severidade.
 */
export function CarMap({ damages, selectedId, onAdd, onSelect, readOnly }: CarMapProps) {
  const ref = useRef<HTMLDivElement>(null);

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (readOnly) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    onAdd(
      Math.min(100, Math.max(0, Number(x.toFixed(2)))),
      Math.min(100, Math.max(0, Number(y.toFixed(2)))),
    );
  }

  return (
    <div
      ref={ref}
      onClick={handleClick}
      className={cn(
        "relative mx-auto max-w-[280px] select-none",
        readOnly ? "cursor-default" : "cursor-crosshair",
      )}
      role="button"
      aria-label="Mapa do veículo — clique para marcar uma avaria"
      tabIndex={0}
    >
      <svg viewBox="0 0 100 200" className="h-auto w-full text-muted-foreground" aria-hidden="true">
        {/* Carroceria */}
        <rect
          x="14"
          y="6"
          width="72"
          height="188"
          rx="22"
          fill="currentColor"
          fillOpacity="0.06"
          stroke="currentColor"
          strokeOpacity="0.35"
          strokeWidth="1.5"
        />
        {/* Para-choque dianteiro / traseiro */}
        <rect x="26" y="8" width="48" height="6" rx="3" fill="currentColor" fillOpacity="0.15" />
        <rect x="26" y="186" width="48" height="6" rx="3" fill="currentColor" fillOpacity="0.15" />
        {/* Capô + para-brisa */}
        <path d="M30 40 L70 40 L64 62 L36 62 Z" fill="currentColor" fillOpacity="0.12" />
        {/* Teto */}
        <rect x="30" y="66" width="40" height="60" rx="8" fill="currentColor" fillOpacity="0.1" />
        {/* Vidro traseiro */}
        <path d="M36 130 L64 130 L70 152 L30 152 Z" fill="currentColor" fillOpacity="0.12" />
        {/* Rodas */}
        <rect x="8" y="42" width="8" height="22" rx="3" fill="currentColor" fillOpacity="0.4" />
        <rect x="84" y="42" width="8" height="22" rx="3" fill="currentColor" fillOpacity="0.4" />
        <rect x="8" y="140" width="8" height="22" rx="3" fill="currentColor" fillOpacity="0.4" />
        <rect x="84" y="140" width="8" height="22" rx="3" fill="currentColor" fillOpacity="0.4" />
        {/* Retrovisores */}
        <rect x="10" y="70" width="6" height="8" rx="2" fill="currentColor" fillOpacity="0.4" />
        <rect x="84" y="70" width="6" height="8" rx="2" fill="currentColor" fillOpacity="0.4" />
      </svg>

      {damages.map((d) => {
        const sev = SEVERITY[d.severity];
        const selected = d.id === selectedId;
        return (
          <button
            key={d.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(d);
            }}
            style={{ left: `${d.x}%`, top: `${d.y}%` }}
            className={cn(
              "absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[11px] font-bold text-white shadow ring-2 ring-white",
              sev.dot,
              selected && "z-10 scale-125 ring-2 ring-offset-1",
              selected && sev.ring,
            )}
            aria-label={`Avaria ${d.sequence}: ${sev.label}`}
          >
            {d.sequence}
          </button>
        );
      })}
    </div>
  );
}
