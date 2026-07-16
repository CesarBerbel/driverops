import { describe, expect, it } from "vitest";

import { compressImage } from "@/lib/imageCompression";

describe("compressImage", () => {
  it("leaves non-image files (PDF) unchanged", async () => {
    const pdf = new File(["x"], "nota.pdf", { type: "application/pdf" });
    expect(await compressImage(pdf)).toBe(pdf);
  });

  it("leaves SVG and GIF unchanged", async () => {
    const svg = new File(["x"], "logo.svg", { type: "image/svg+xml" });
    const gif = new File(["x"], "anim.gif", { type: "image/gif" });
    expect(await compressImage(svg)).toBe(svg);
    expect(await compressImage(gif)).toBe(gif);
  });

  it("returns the original when the image can't be decoded (no bitmap support)", async () => {
    // Em jsdom não há suporte a createImageBitmap/canvas -> degrada para o original,
    // garantindo que o upload nunca quebra por causa da compressão.
    const jpg = new File(["x"], "foto.jpg", { type: "image/jpeg" });
    expect(await compressImage(jpg)).toBe(jpg);
  });
});
