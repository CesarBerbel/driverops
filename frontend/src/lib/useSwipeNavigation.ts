import { useRef } from "react";

interface SwipeHandlers {
  onNext: () => void;
  onPrev: () => void;
}

const MIN_DISTANCE = 50; // px -- ignore taps and tiny drags
const HORIZONTAL_RATIO = 1.5; // horizontal must clearly dominate vertical

// Touch-only horizontal swipe. Never calls preventDefault, so vertical scroll
// and taps/clicks keep working; only a clearly horizontal drag triggers a tab
// change. Mouse events don't fire touch handlers, so desktop is unaffected.
export function useSwipeNavigation({ onNext, onPrev }: SwipeHandlers) {
  const start = useRef<{ x: number; y: number } | null>(null);

  function onTouchStart(event: React.TouchEvent) {
    const touch = event.touches[0];
    start.current = { x: touch.clientX, y: touch.clientY };
  }

  function onTouchEnd(event: React.TouchEvent) {
    if (!start.current) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.current.x;
    const dy = touch.clientY - start.current.y;
    start.current = null;

    if (Math.abs(dx) < MIN_DISTANCE) return; // not a real horizontal swipe
    if (Math.abs(dx) < Math.abs(dy) * HORIZONTAL_RATIO) return; // vertical scroll

    if (dx < 0) onNext();
    else onPrev();
  }

  return { onTouchStart, onTouchEnd };
}
