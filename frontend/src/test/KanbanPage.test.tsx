import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { KanbanPage } from "@/features/kanban/pages/KanbanPage";
import * as ordersApi from "@/features/orders/api";
import * as settingsApi from "@/features/settings/api";
import type { OrderStatus, WorkOrder } from "@/features/orders/types";
import type { KanbanSettings } from "@/features/settings/types";

vi.mock("@/features/orders/api");
vi.mock("@/features/settings/api");

function workOrder(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: 1,
    number: 1,
    customer: 1,
    customer_name: "Maria Silva",
    customer_whatsapp: "11987654321",
    customer_phone: "",
    vehicle: 1,
    vehicle_plate: "ABC1D23",
    vehicle_description: "Honda Fit 1.5",
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
    gross_total: "327.00",
    final_value: "327.00",
    amount_paid: "0.00",
    balance_due: "327.00",
    payment_status: "open",
    created_at: "2026-07-04T00:00:00Z",
    updated_at: "2026-07-04T00:00:00Z",
    ...overrides,
  };
}

const DEFAULT_SETTINGS: KanbanSettings = {
  updated_at: "2026-07-04T00:00:00Z",
  columns: [
    { status: "open", visible: true },
    { status: "diagnosing", visible: true },
    { status: "awaiting_approval", visible: true },
    { status: "approved", visible: true },
    { status: "in_progress", visible: true },
    { status: "awaiting_parts", visible: true },
    { status: "testing", visible: true },
    { status: "ready", visible: true },
    { status: "finished", visible: false },
    { status: "canceled", visible: false },
  ],
};

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/kanban"]}>
        <Routes>
          <Route path="/kanban" element={<KanbanPage />} />
          <Route path="/settings/kanban" element={<div>CONFIG KANBAN</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("KanbanPage (desktop board)", () => {
  beforeEach(() => {
    mockMatchMedia(true); // lg and up -> horizontal board
    vi.mocked(settingsApi.getKanbanSettings).mockResolvedValue(DEFAULT_SETTINGS);
    vi.mocked(ordersApi.listWorkOrders).mockReset();
    vi.mocked(ordersApi.moveWorkOrder).mockReset();
  });

  it("renders only the visible columns (finished/canceled hidden by default)", async () => {
    vi.mocked(ordersApi.listWorkOrders).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByRole("region", { name: "Coluna Aberta" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Coluna Pronta para entrega" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Coluna Finalizada" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Coluna Cancelada" })).not.toBeInTheDocument();
  });

  it("fetches only the visible statuses", async () => {
    vi.mocked(ordersApi.listWorkOrders).mockResolvedValue([]);
    renderPage();
    await waitFor(() =>
      expect(ordersApi.listWorkOrders).toHaveBeenCalledWith(
        expect.objectContaining({
          statuses: expect.not.arrayContaining(["finished", "canceled"]),
        }),
      ),
    );
  });

  it("renders a plate card with plate, OS number, customer and clickable WhatsApp", async () => {
    vi.mocked(ordersApi.listWorkOrders).mockResolvedValue([workOrder()]);
    renderPage();

    expect(await screen.findByText("ABC1D23")).toBeInTheDocument();
    expect(screen.getByText("OS 0001")).toBeInTheDocument();
    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    const waLink = screen.getByRole("link", { name: /98765-4321/ });
    expect(waLink).toHaveAttribute("href", "https://wa.me/5511987654321");
  });

  it("opens the quick-view modal when a card is clicked", async () => {
    vi.mocked(ordersApi.listWorkOrders).mockResolvedValue([workOrder()]);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /Ordem de serviço OS 0001/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Barulho no motor")).toBeInTheDocument();
  });

  it("moves an OS to a valid status via the 'Mover' menu (backend call)", async () => {
    const order = workOrder();
    vi.mocked(ordersApi.listWorkOrders).mockResolvedValue([order]);
    vi.mocked(ordersApi.moveWorkOrder).mockResolvedValue({
      ...order,
      status: "diagnosing" as OrderStatus,
      status_display: "Em diagnóstico",
    });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("ABC1D23");
    await user.click(screen.getByRole("button", { name: "Mover OS de status" }));
    await user.click(await screen.findByRole("menuitem", { name: "Em diagnóstico" }));

    await waitFor(() =>
      expect(ordersApi.moveWorkOrder).toHaveBeenCalledWith(1, "diagnosing"),
    );
  });
});

describe("KanbanPage (mobile/tablet accordion)", () => {
  beforeEach(() => {
    mockMatchMedia(false); // below lg -> accordion
    vi.mocked(settingsApi.getKanbanSettings).mockResolvedValue(DEFAULT_SETTINGS);
    vi.mocked(ordersApi.listWorkOrders).mockReset();
  });

  it("renders columns as accordion sections; only the first is expanded", async () => {
    vi.mocked(ordersApi.listWorkOrders).mockResolvedValue([
      workOrder({ id: 1, number: 1, vehicle_plate: "ABC1D23", status: "open" }),
      workOrder({
        id: 2,
        number: 2,
        vehicle_plate: "XYZ9A88",
        status: "in_progress" as OrderStatus,
        status_display: "Em execução",
      }),
    ]);
    const user = userEvent.setup();
    renderPage();

    // First section (Aberta) is open -> its card is visible; the collapsed
    // "Em execução" section hides its card until expanded.
    expect(await screen.findByText("ABC1D23")).toBeInTheDocument();
    expect(screen.queryByText("XYZ9A88")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Em execução/ }));
    expect(await screen.findByText("XYZ9A88")).toBeInTheDocument();
  });
});
