import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginPage } from "@/features/auth/pages/LoginPage";

const loginMock = vi.fn();

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({ login: loginMock }),
}));

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    loginMock.mockReset();
  });

  it("shows validation errors when submitted empty", async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Informe seu e-mail.")).toBeInTheDocument();
    expect(screen.getByText("Informe sua senha.")).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it("logs in and navigates to the dashboard on success", async () => {
    loginMock.mockResolvedValue({ id: 1, email: "user@example.com" });
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText("E-mail"), "user@example.com");
    await user.type(screen.getByLabelText("Senha"), "StrongPass123");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(screen.getByText("Dashboard")).toBeInTheDocument());
    expect(loginMock).toHaveBeenCalledWith("user@example.com", "StrongPass123");
  });

  it("shows an inline error when credentials are invalid", async () => {
    loginMock.mockRejectedValue({
      isAxiosError: true,
      response: { data: { detail: "E-mail ou senha inválidos." } },
    });
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText("E-mail"), "user@example.com");
    await user.type(screen.getByLabelText("Senha"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("E-mail ou senha inválidos.")).toBeInTheDocument();
  });
});
