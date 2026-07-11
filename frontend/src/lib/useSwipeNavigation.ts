import { useRef } from "react";

interface SwipeHandlers {
  onNext: () => void;
  onPrev: () => void;
}

const MIN_DISTANCE = 50; // px -- ignore taps and tiny drags
const HORIZONTAL_RATIO = 1.5; // horizontal must clearly dominate vertical

// Touch-only horizontal swipe. Dispara assim que um arraste claramente
// horizontal cruza o limiar (no touchmove), em vez de esperar o touchend -- que
// o navegador pode engolir como touchcancel durante um gesto horizontal, o que
// fazia o swipe "não pegar". Vertical scroll, toques e cliques continuam
// funcionando; só um arraste horizontal dominante troca de aba, uma vez por
// gesto. Eventos de mouse não disparam handlers de toque, então o desktop não é
// afetado. Pareie com `touch-action: pan-y` no elemento para o navegador não
// sequestrar o gesto horizontal.
export function useSwipeNavigation({ onNext, onPrev }: SwipeHandlers) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  function onTouchStart(event: React.TouchEvent) {
    const touch = event.touches[0];
    start.current = { x: touch.clientX, y: touch.clientY };
    fired.current = false;
  }

  function onTouchMove(event: React.TouchEvent) {
    if (!start.current || fired.current) return;
    const touch = event.touches[0];
    const dx = touch.clientX - start.current.x;
    const dy = touch.clientY - start.current.y;

    if (Math.abs(dx) < MIN_DISTANCE) return; // ainda não é um swipe de verdade
    if (Math.abs(dx) < Math.abs(dy) * HORIZONTAL_RATIO) return; // scroll vertical

    fired.current = true; // uma troca por gesto
    if (dx < 0) onNext();
    else onPrev();
  }

  function onTouchEnd() {
    start.current = null;
    fired.current = false;
  }

  return { onTouchStart, onTouchMove, onTouchEnd };
}
