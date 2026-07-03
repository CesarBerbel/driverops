import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// jsdom doesn't implement these, but Radix's Select/Dialog primitives call
// them during pointer interactions -- without stubs, user-event clicks on
// those components throw.
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
window.HTMLElement.prototype.releasePointerCapture = vi.fn();
