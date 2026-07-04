import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { Topbar } from "@/components/layout/Topbar";

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({
    user: { id: 1, email: "user@example.com", full_name: "Jane Doe", is_superuser: false },
    logout: vi.fn(),
  }),
}));

describe("Topbar", () => {
  it("renders only the Dashboard link and the user menu -- no sidebar/hamburger", () => {
    render(
      <MemoryRouter>
        <Topbar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.queryByLabelText("Abrir menu")).not.toBeInTheDocument();
  });

  it("has an always-visible 'Nova OS' action pointing to the OS editor", () => {
    render(
      <MemoryRouter>
        <Topbar />
      </MemoryRouter>,
    );

    const novaOs = screen.getByRole("link", { name: /nova os/i });
    expect(novaOs).toHaveAttribute("href", "/orders/new");
  });
});
