import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { confirmPasswordReset } from "@/features/auth/api";
import { ResetPasswordPage } from "@/features/auth/pages/ResetPasswordPage";

vi.mock("@/features/auth/api", () => ({
  confirmPasswordReset: vi.fn(),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.mocked(confirmPasswordReset).mockReset();
  });

  it("shows an invalid-link message and does not call the API when uid/token are missing", () => {
    renderAt("/reset-password");

    expect(screen.getByText(/link de redefinição é inválido/i)).toBeInTheDocument();
    expect(confirmPasswordReset).not.toHaveBeenCalled();
  });

  it("submits the confirm request with uid/token from the URL", async () => {
    vi.mocked(confirmPasswordReset).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderAt("/reset-password?uid=abc123&token=xyz789");

    await user.type(screen.getByLabelText("Nova senha"), "BrandNewPass456");
    await user.type(screen.getByLabelText("Confirmar nova senha"), "BrandNewPass456");
    await user.click(screen.getByRole("button", { name: "Redefinir senha" }));

    expect(confirmPasswordReset).toHaveBeenCalledWith({
      uid: "abc123",
      token: "xyz789",
      new_password: "BrandNewPass456",
      new_password_confirm: "BrandNewPass456",
    });
  });
});
