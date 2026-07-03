import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// jsdom doesn't implement these, but Radix's Select/Dialog primitives call
// them during pointer interactions -- without stubs, user-event clicks on
// those components throw.
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
window.HTMLElement.prototype.releasePointerCapture = vi.fn();

// jsdom doesn't implement matchMedia, but sonner's <Toaster> reads it to
// resolve the "system" theme on mount.
window.matchMedia =
  window.matchMedia ??
  vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
