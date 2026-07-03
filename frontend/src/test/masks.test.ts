import { describe, expect, it } from "vitest";

import {
  formatCEP,
  formatCNPJ,
  formatCPF,
  formatDocument,
  formatPhone,
  formatUF,
  onlyDigits,
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
