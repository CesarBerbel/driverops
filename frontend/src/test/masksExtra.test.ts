import { describe, expect, it } from "vitest";

import {
  formatCentsAsBRL,
  formatMinutes,
  parseCurrencyBRL,
  parsePercent,
} from "@/lib/masks";

const noNbsp = (s: string) => s.replace(/ /g, " ");

describe("masks: coverage top-up", () => {
  it("formatMinutes renders hours and minutes", () => {
    expect(formatMinutes(90)).toBe("1h 30min");
    expect(formatMinutes(120)).toBe("2h");
    expect(formatMinutes(45)).toBe("45min");
    expect(formatMinutes(0)).toBe("");
    expect(formatMinutes(-5)).toBe("");
    expect(formatMinutes(Number.NaN)).toBe("");
  });

  it("formatCentsAsBRL shifts cents", () => {
    expect(noNbsp(formatCentsAsBRL("12050"))).toBe("R$ 120,50");
    expect(noNbsp(formatCentsAsBRL(""))).toBe("R$ 0,00");
  });

  it("parseCurrencyBRL handles the no-separator branch", () => {
    expect(parseCurrencyBRL("1234")).toBe(1234);
    expect(parseCurrencyBRL("R$ 50")).toBe(50);
    expect(parseCurrencyBRL("")).toBeNull();
    expect(parseCurrencyBRL("---")).toBeNull();
  });

  it("parsePercent", () => {
    expect(parsePercent("15,5")).toBe(15.5);
    expect(parsePercent("10")).toBe(10);
    expect(parsePercent("")).toBeNull();
  });
});
