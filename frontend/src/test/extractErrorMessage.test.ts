import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";

import { extractErrorMessage } from "@/lib/api-client";

function axiosErrorWith(data: unknown): AxiosError {
  return new AxiosError(
    "request failed",
    "ERR_BAD_REQUEST",
    undefined,
    undefined,
    { data, status: 400, statusText: "Bad Request", headers: {}, config: {} } as never,
  );
}

describe("extractErrorMessage", () => {
  it("returns DRF `detail`", () => {
    const err = axiosErrorWith({ detail: "Placa já cadastrada." });
    expect(extractErrorMessage(err, "fallback")).toBe("Placa já cadastrada.");
  });

  it("returns the first `non_field_errors`", () => {
    const err = axiosErrorWith({ non_field_errors: ["Combinação inválida."] });
    expect(extractErrorMessage(err, "fallback")).toBe("Combinação inválida.");
  });

  it("returns the first field error when there is no detail", () => {
    const err = axiosErrorWith({ email: ["Já existe um cliente com este e-mail."] });
    expect(extractErrorMessage(err, "fallback")).toBe(
      "Já existe um cliente com este e-mail.",
    );
  });

  it("falls back when the response body is empty", () => {
    expect(extractErrorMessage(axiosErrorWith(undefined), "fallback")).toBe("fallback");
  });

  it("falls back for a non-axios error", () => {
    expect(extractErrorMessage(new Error("boom"), "fallback")).toBe("fallback");
    expect(extractErrorMessage("weird", "fallback")).toBe("fallback");
  });
});
