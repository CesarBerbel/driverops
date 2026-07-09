import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { Topbar } from "@/components/layout/Topbar";

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: 1,
      email: "user@example.com",
      full_name: "Jane Doe",
      is_superuser: true,
      permissions: [],
    },
    logout: vi.fn(),
  }),
}));

vi.mock("@/features/leads/api", () => ({
  getLeadsPendingCount: vi.fn().mockResolvedValue(0),
}));

vi.mock("@/features/alerts/api", () => ({
  getUnreadCount: vi.fn().mockResolvedValue(0),
  listNotifications: vi.fn().mockResolvedValue([]),
  markAllRead: vi.fn(),
  markRead: vi.fn(),
}));

function renderTopbar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Topbar />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Topbar", () => {
  it("renders the Dashboard link and the user menu -- no sidebar/hamburger", () => {
    renderTopbar();
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.queryByLabelText("Abrir menu")).not.toBeInTheDocument();
  });

  it("has a 'Kanban OS' link in the top navigation", () => {
    renderTopbar();
    const kanban = screen.getByRole("link", { name: /kanban os/i });
    expect(kanban).toHaveAttribute("href", "/kanban");
  });

  it("has an always-visible 'Nova OS' action pointing to the OS editor", () => {
    renderTopbar();
    const novaOs = screen.getByRole("link", { name: /nova os/i });
    expect(novaOs).toHaveAttribute("href", "/orders/new");
  });
});
