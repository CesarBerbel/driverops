import { Car } from "lucide-react";

interface BrandMarkProps {
  logo?: string;
  name: string;
  /** Tamanho do mark quando não há logo carregado. */
  size?: "sm" | "md";
  eager?: boolean;
}

/**
 * Marca da oficina: usa o logo cadastrado quando disponível; caso contrário,
 * um mark tipográfico com o carro em uma moldura azul, evocando a identidade do
 * logo (fundo escuro, moldura azul, carro branco, nome em destaque).
 */
export function BrandMark({ logo, name, size = "md", eager }: BrandMarkProps) {
  if (logo) {
    return (
      <img
        src={logo}
        alt={name}
        loading={eager ? "eager" : "lazy"}
        className={size === "sm" ? "h-9 w-auto object-contain" : "h-11 w-auto object-contain"}
      />
    );
  }

  const box = size === "sm" ? "size-9" : "size-11";
  const icon = size === "sm" ? "size-5" : "size-6";
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`grid ${box} shrink-0 place-items-center rounded-md border-2 border-[#2a4fd6] bg-black`}
        aria-hidden="true"
      >
        <Car className={`${icon} text-white`} />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-sm font-extrabold uppercase tracking-wide text-white">
          {name}
        </span>
        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#e11d2a]">
          Auto Mecânica
        </span>
      </span>
    </span>
  );
}
