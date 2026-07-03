import { describe, expect, it } from "vitest";

import { formatPlateForDisplay, isValidPlate, normalizePlate } from "@/features/vehicles/plate";

describe("normalizePlate", () => {
  it("uppercases and strips separators", () => {
    expect(normalizePlate("abc-1234")).toBe("ABC1234");
    expect(normalizePlate("abc 1234")).toBe("ABC1234");
    expect(normalizePlate("abc1d23")).toBe("ABC1D23");
  });

  it("caps at 7 characters", () => {
    expect(normalizePlate("abc12345678")).toBe("ABC1234");
  });

  it("handles empty input", () => {
    expect(normalizePlate("")).toBe("");
  });
});

describe("isValidPlate", () => {
  it("accepts the old format", () => {
    expect(isValidPlate("ABC1234")).toBe(true);
  });

  it("accepts the Mercosul format", () => {
    expect(isValidPlate("ABC1D23")).toBe(true);
  });

  it("rejects formats matching neither pattern", () => {
    expect(isValidPlate("AB1234")).toBe(false);
    expect(isValidPlate("ABCD123")).toBe(false);
    expect(isValidPlate("")).toBe(false);
  });
});

describe("formatPlateForDisplay", () => {
  it("adds a hyphen for the old format", () => {
    expect(formatPlateForDisplay("ABC1234")).toBe("ABC-1234");
  });

  it("leaves the Mercosul format as-is", () => {
    expect(formatPlateForDisplay("ABC1D23")).toBe("ABC1D23");
  });
});
