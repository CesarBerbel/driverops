import { describe, expect, it } from "vitest";

import { buildWhatsAppUrl } from "@/lib/whatsapp";

describe("buildWhatsAppUrl", () => {
  it("prefixes the Brazil country code and strips mask characters", () => {
    expect(buildWhatsAppUrl("11987654321")).toBe("https://wa.me/5511987654321");
    expect(buildWhatsAppUrl("(11) 98765-4321")).toBe("https://wa.me/5511987654321");
  });
});
