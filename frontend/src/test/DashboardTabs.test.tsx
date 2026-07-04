import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardTabs } from "@/features/dashboard/components/DashboardTabs";
import * as dashboardApi from "@/features/dashboard/api";
import * as ordersApi from "@/features/orders/api";

vi.mock("@/features/orders/api");
vi.mock("@/features/dashboard/api");
vi.mock("@/features/auth/api");

const auth = vi.hoisted(() => ({
  user: { is_superuser: false, full_name: "Dev" } as Record<string, unknown>,
}));
vi.mock("@/features/auth/useAuth", () => ({ useAuth: () => ({ user: auth.user }) }));

function renderTabs(initial = "/dashboard") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initial]}>
        <DashboardTabs />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const STATS = {
  period: "month",
  customers_total: 4,
  vehicles_total: 3,
  suppliers_total: 1,
  parts_total: 5,
  parts_low_stock: 2,
  services_total: 6,
  packages_total: 1,
  os_open: 7,
  os_in_progress: 2,
  os_finished_period: 3,
  os_open_value: "1000.00",
  finished_value_period: "500.00",
};

describe("DashboardTabs", () => {
  beforeEach(() => {
    vi.mocked(ordersApi.listWorkOrders).mockReset().mockResolvedValue([]);
    vi.mocked(dashboardApi.getDashboardStats).mockReset().mockResolvedValue(STATS);
  });

  it("opens on the Operacional tab by default", async () => {
    renderTabs();
    expect(screen.getByRole("tab", { name: "Operacional" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // Operacional shows the quick-access module cards (the OS hero now lives
    // above the tabs, in DashboardPage).
    expect(screen.getByText("Clientes")).toBeInTheDocument();
    expect(screen.getByText("Estoque")).toBeInTheDocument();
  });

  it("switches to the OS board when the OS tab is clicked", async () => {
    const user = userEvent.setup();
    renderTabs();
    await user.click(screen.getByRole("tab", { name: "OS" }));
    expect(await screen.findByText("Nenhuma OS aberta no momento.")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma OS em andamento no momento.")).toBeInTheDocument();
  });

  it("switches to the Administrativo indicators when its tab is clicked", async () => {
    const user = userEvent.setup();
    renderTabs();
    await user.click(screen.getByRole("tab", { name: "Administrativo" }));
    expect(await screen.findByText("OS abertas")).toBeInTheDocument();
    expect(screen.getByText("Peças com estoque baixo")).toBeInTheDocument();
  });

  it("honors the ?tab=os query param on load", async () => {
    renderTabs("/dashboard?tab=os");
    expect(screen.getByRole("tab", { name: "OS" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("Nenhuma OS aberta no momento.")).toBeInTheDocument();
  });

  it("advances to the next tab on a left swipe and back on a right swipe", async () => {
    renderTabs();
    const panel = screen.getByRole("tabpanel");

    // Swipe left (dx negative) -> next tab (OS).
    fireEvent.touchStart(panel, { touches: [{ clientX: 240, clientY: 100 }] });
    fireEvent.touchEnd(panel, { changedTouches: [{ clientX: 100, clientY: 108 }] });
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "OS" })).toHaveAttribute("aria-selected", "true"),
    );

    // Swipe right (dx positive) -> previous tab (Operacional).
    fireEvent.touchStart(panel, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchEnd(panel, { changedTouches: [{ clientX: 250, clientY: 105 }] });
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Operacional" })).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    );
  });

  it("does not change tab on a mostly-vertical drag (scroll)", async () => {
    renderTabs();
    const panel = screen.getByRole("tabpanel");
    fireEvent.touchStart(panel, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(panel, { changedTouches: [{ clientX: 180, clientY: 400 }] });
    expect(screen.getByRole("tab", { name: "Operacional" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
