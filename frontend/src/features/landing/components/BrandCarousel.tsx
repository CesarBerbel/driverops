import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface BrandCarouselProps {
  brands: string[];
}

export function BrandCarousel({ brands }: BrandCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  function scrollByCards(direction: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy?.({ left: direction * Math.min(el.clientWidth * 0.8, 400), behavior: "smooth" });
  }

  // Autoplay suave, pausado ao interagir e desligado quando o usuário prefere
  // menos movimento (acessibilidade).
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || paused) return;
    const id = window.setInterval(() => {
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 4) {
        el.scrollTo?.({ left: 0, behavior: "smooth" });
      } else {
        el.scrollBy?.({ left: 1.2, behavior: "auto" });
      }
    }, 30);
    return () => window.clearInterval(id);
  }, [paused, brands.length]);

  if (brands.length === 0) {
    return (
      <p className="text-center text-sm text-white/50">
        Trabalhamos com diversas marcas nacionais e importadas.
      </p>
    );
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <button
        type="button"
        aria-label="Marcas anteriores"
        onClick={() => scrollByCards(-1)}
        className="absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-white/15 bg-black/70 p-2 text-white hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b8bff] sm:inline-flex"
      >
        <ChevronLeft className="size-5" />
      </button>

      <div
        ref={trackRef}
        role="list"
        aria-label="Marcas atendidas"
        className="flex snap-x gap-3 overflow-x-auto scroll-smooth px-1 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {brands.map((brand) => (
          <div
            key={brand}
            role="listitem"
            className="flex h-20 w-36 shrink-0 snap-start items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 text-center text-sm font-semibold text-white/85 transition-colors hover:border-[#2a4fd6]/60 hover:bg-white/[0.07]"
          >
            {brand}
          </div>
        ))}
      </div>

      <button
        type="button"
        aria-label="Próximas marcas"
        onClick={() => scrollByCards(1)}
        className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-white/15 bg-black/70 p-2 text-white hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b8bff] sm:inline-flex"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}
