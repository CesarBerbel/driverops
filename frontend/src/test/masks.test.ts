import { describe, expect, it } from "vitest";

import {
  formatCEP,
  formatCNPJ,
  formatCPF,
  formatCurrencyBRL,
  formatDocument,
  formatNCM,
  formatPhone,
  formatQuantityBRL,
  formatUF,
  normalizeNCM,
  onlyDigits,
  parseCurrencyBRL,
  parseQuantityBRL,
} from "@/lib/masks";

describe("onlyDigits", () => {
  it("strips everything but digits", () => {
    expect(onlyDigits("(11) 98765-4321")).toBe("11987654321");
    expect(onlyDigits("abc123def456")).toBe("123456");
    expect(onlyDigits("")).toBe("");
  });
});

describe("formatPhone", () => {
  it("formats an 11-digit mobile number", () => {
    expect(formatPhone("11987654321")).toBe("(11) 98765-4321");
  });

  it("formats a 10-digit landline number", () => {
    expect(formatPhone("1132654321")).toBe("(11) 3265-4321");
  });

  it("formats partial input as the user types", () => {
    expect(formatPhone("1")).toBe("(1");
    expect(formatPhone("11")).toBe("(11");
    expect(formatPhone("119")).toBe("(11) 9");
  });

  it("strips mask characters from pasted input before formatting", () => {
    expect(formatPhone("(11) 98765-4321")).toBe("(11) 98765-4321");
  });
});

describe("formatCPF", () => {
  it("formats a complete CPF", () => {
    expect(formatCPF("12345678900")).toBe("123.456.789-00");
  });

  it("formats partial input", () => {
    expect(formatCPF("123")).toBe("123");
    expect(formatCPF("1234567")).toBe("123.456.7");
  });
});

describe("formatCNPJ", () => {
  it("formats a complete CNPJ", () => {
    expect(formatCNPJ("12345678000195")).toBe("12.345.678/0001-95");
  });
});

describe("formatDocument", () => {
  it("dispatches to CPF for individual and CNPJ for company", () => {
    expect(formatDocument("12345678900", "individual")).toBe("123.456.789-00");
    expect(formatDocument("12345678000195", "company")).toBe("12.345.678/0001-95");
  });
});

describe("formatCEP", () => {
  it("formats a complete CEP", () => {
    expect(formatCEP("01310100")).toBe("01310-100");
  });

  it("formats partial input", () => {
    expect(formatCEP("013")).toBe("013");
  });
});

describe("formatUF", () => {
  it("uppercases and limits to 2 letters", () => {
    expect(formatUF("sp")).toBe("SP");
    expect(formatUF("minas")).toBe("MI");
  });

  it("strips non-letter characters", () => {
    expect(formatUF("s1p")).toBe("SP");
  });
});

describe("formatCurrencyBRL", () => {
  it("formats a value in Brazilian Real", () => {
    expect(formatCurrencyBRL(120.5)).toBe("R$ 120,50");
    expect(formatCurrencyBRL(1234.56)).toBe("R$ 1.234,56");
    expect(formatCurrencyBRL(0)).toBe("R$ 0,00");
  });
});

describe("parseCurrencyBRL", () => {
  it("parses a comma-decimal value", () => {
    expect(parseCurrencyBRL("120,50")).toBe(120.5);
  });

  it("tolerates the R$ prefix", () => {
    expect(parseCurrencyBRL("R$ 120,50")).toBe(120.5);
  });

  it("tolerates a dot-decimal value pasted without R$", () => {
    expect(parseCurrencyBRL("120.50")).toBe(120.5);
  });

  it("tolerates thousands separators", () => {
    expect(parseCurrencyBRL("R$ 1.234,56")).toBe(1234.56);
  });

  it("returns null for empty input", () => {
    expect(parseCurrencyBRL("")).toBeNull();
  });
});

describe("formatQuantityBRL", () => {
  it("formats an integer without decimals", () => {
    expect(formatQuantityBRL(1000)).toBe("1.000");
  });

  it("formats a fractional value with a comma decimal", () => {
    expect(formatQuantityBRL(1000.5)).toBe("1.000,5");
  });
});

describe("parseQuantityBRL", () => {
  it("parses an integer", () => {
    expect(parseQuantityBRL("1000")).toBe(1000);
  });

  it("parses a comma-decimal value", () => {
    expect(parseQuantityBRL("1000,5")).toBe(1000.5);
  });

  it("returns null for empty input", () => {
    expect(parseQuantityBRL("")).toBeNull();
  });
});

describe("normalizeNCM", () => {
  it("strips non-digits and caps at 8 characters", () => {
    expect(normalizeNCM("8708.99.90")).toBe("87089990");
    expect(normalizeNCM("870899901234")).toBe("87089990");
  });
});

describe("formatNCM", () => {
  it("groups progressively as the user types", () => {
    expect(formatNCM("8708")).toBe("8708");
    expect(formatNCM("870899")).toBe("8708.99");
    expect(formatNCM("87089990")).toBe("8708.99.90");
  });
});
