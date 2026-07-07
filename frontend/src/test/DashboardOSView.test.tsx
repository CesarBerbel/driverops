import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardOSView } from "@/features/dashboard/components/DashboardOSView";
import * as ordersApi from "@/features/orders/api";
import type { OrderStatus, WorkOrder } from "@/features/orders/types";

vi.mock("@/features/orders/api");

function workOrder(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: 1,
    number: 1,
    customer: 1,
    customer_name: "Maria Silva",
    customer_whatsapp: "11987654321",
    customer_phone: "",
    vehicle: 1,
    vehicle_plate: "ABC1234",
    vehicle_description: "Fiat Uno",
    status: "open",
    status_display: "Aberta",
    assigned_technician: null,
    assigned_technician_name: null,
    opened_at: "2026-07-04",
    expected_delivery: "2026-07-11",
    current_mileage: null,
    customer_report: "Barulho no motor",
    diagnosis: "",
    internal_notes: "",
    service_items: [],
    package_items: [],
    part_items: [],
    discount_type: "none",
    discount_value: "0.00",
    services_total: "0.00",
    packages_total: "0.00",
    parts_total: "0.00",
    gross_total: "150.00",
    final_value: "150.00",
    amount_paid: "0.00",
    balance_due: "150.00",
    payment_status: "open",
    created_at: "2026-07-04T00:00:00Z",
    updated_at: "2026-07-04T00:00:00Z",
    ...overrides,
  };
}

function renderView() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/dashboard" element={<DashboardOSView />} />
          <Route path="/orders/:id" element={<div>EDITOR DA OS</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("DashboardOSView", () => {
  beforeEach(() => {
    vi.mocked(ordersApi.listWorkOrders).mockReset();
  });

  it("requests only the operational board", async () => {
    vi.mocked(ordersApi.listWorkOrders).mockResolvedValue([]);
    renderView();
    await waitFor(() =>
      expect(ordersApi.listWorkOrders).toHaveBeenCalledWith(
        expect.objectContaining({ board: "operational" }),
      ),
    );
  });

  it("splits OS into Abertas and Em andamento columns", async () => {
    vi.mocked(ordersApi.listWorkOrders).mockResolvedValue([
      workOrder({ id: 1, number: 1, vehicle_plate: "ABC1234", status: "open" }),
      workOrder({
        id: 2,
        number: 2,
        vehicle_plate: "XYZ9A88",
        status: "in_progress" as OrderStatus,
        status_display: "Em execução",
      }),
    ]);
    renderView();
    expect(await screen.findByText("ABC-1234")).toBeInTheDocument();
    expect(screen.getByText("XYZ9A88")).toBeInTheDocument();
    // Card shows the customer and a clickable WhatsApp link.
    expect(screen.getAllByText("Maria Silva").length).toBeGreaterThan(0);
    const waLink = screen.getAllByRole("link", { name: /98765-4321/ })[0];
    expect(waLink).toHaveAttribute("href", "https://wa.me/5511987654321");
  });

  it("shows empty states when there are no OS", async () => {
    vi.mocked(ordersApi.listWorkOrders).mockResolvedValue([]);
    renderView();
    expect(await screen.findByText("Nenhuma OS aberta no momento.")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma OS em andamento no momento.")).toBeInTheDocument();
  });

  it("opens the quick-view modal on card click, then navigates to the editor", async () => {
    vi.mocked(ordersApi.listWorkOrders).mockResolvedValue([workOrder()]);
    const user = userEvent.setup();
    renderView();

    await user.click(await screen.findByRole("button", { name: /Ordem de serviço OS 0001/ }));

    const dialog = await screen.findByRole("dialog");
    // Quick view (not the editor) -- shows the report and an "Abrir OS" action.
    expect(within(dialog).getByText("Barulho no motor")).toBeInTheDocument();
    expect(screen.queryByText("EDITOR DA OS")).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: /Abrir OS/ }));
    expect(await screen.findByText("EDITOR DA OS")).toBeInTheDocument();
  });
});
