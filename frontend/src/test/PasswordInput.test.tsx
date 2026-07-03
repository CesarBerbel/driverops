import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { PasswordInput } from "@/components/shared/PasswordInput";

describe("PasswordInput", () => {
  it("starts hidden and toggles to visible on click", async () => {
    const user = userEvent.setup();
    render(<PasswordInput placeholder="Senha" />);

    const input = screen.getByPlaceholderText("Senha");
    expect(input).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: /mostrar senha/i }));
    expect(input).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: /ocultar senha/i }));
    expect(input).toHaveAttribute("type", "password");
  });
});
