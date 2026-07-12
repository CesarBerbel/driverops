import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, is_superuser: true, permissions: [] } }),
}));

import { Toaster } from "@/components/ui/sonner";
import * as ordersApi from "@/features/orders/api";
import { OrdersPage } from "@/features/orders/pages/OrdersPage";
import type { WorkOrder } from "@/features/orders/types";
import type { Paginated } from "@/lib/pagination";

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
    expected_delivery: null,
    current_mileage: null,
    customer_report: "Barulho",
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
    payment_due_date: null,
    aging_bucket: null,
    aging_bucket_display: null,
    days_overdue: 0,
    is_overdue: false,
    quote_status: null,
    quote_status_display: null,
    created_at: "2026-07-04T00:00:00Z",
    updated_at: "2026-07-04T00:00:00Z",
    ...overrides,
  };
}

// Envelope paginado do backend a partir de uma lista de OS.
function paged(items: WorkOrder[]): Paginated<WorkOrder> {
  return { count: items.length, next: null, previous: null, results: items };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/orders"]}>
        <OrdersPage />
      </MemoryRouter>
      <Toaster />
    </QueryClientProvider>,
  );
}

describe("OrdersPage", () => {
  beforeEach(() => {
    vi.mocked(ordersApi.listWorkOrdersPage).mockReset();
    vi.mocked(ordersApi.deleteWorkOrder).mockReset();
    vi.mocked(ordersApi.reactivateWorkOrder).mockReset();
  });

  it("renders the heading and 'Nova OS' button", async () => {
    vi.mocked(ordersApi.listWorkOrdersPage).mockResolvedValue(paged([]));
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "Ordens de Serviço" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /nova os/i })).toBeInTheDocument();
  });

  it("shows the empty state and queries active by default", async () => {
    vi.mocked(ordersApi.listWorkOrdersPage).mockResolvedValue(paged([]));
    renderPage();
    expect(
      await screen.findByText("Nenhuma ordem de serviço cadastrada ainda."),
    ).toBeInTheDocument();
    expect(ordersApi.listWorkOrdersPage).toHaveBeenCalledWith(1, {
      search: undefined,
      active: "active",
      status: undefined,
    });
  });

  it("opens the editor when the clickable OS number is clicked", async () => {
    vi.mocked(ordersApi.listWorkOrdersPage).mockResolvedValue(paged([workOrder()]));
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/orders"]}>
          <Routes>
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/:id" element={<div>EDITOR DA OS</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const table = await screen.findByRole("table");
    await user.click(within(table).getByRole("button", { name: "OS 0001" }));
    expect(await screen.findByText("EDITOR DA OS")).toBeInTheDocument();
  });

  it("lists an OS with number, plate, customer and a clickable WhatsApp link", async () => {
    vi.mocked(ordersApi.listWorkOrdersPage).mockResolvedValue(paged([workOrder()]));
    renderPage();
    const table = await screen.findByRole("table");
    expect(within(table).getByText("OS 0001")).toBeInTheDocument();
    expect(within(table).getByText("ABC1234")).toBeInTheDocument();
    expect(within(table).getByText("Maria Silva")).toBeInTheDocument();
    expect(within(table).getByText("R$ 150,00")).toBeInTheDocument();
    expect(within(table).getByText("04/07/2026")).toBeInTheDocument();
    const link = within(table).getByRole("link", { name: /98765-4321/ });
    expect(link).toHaveAttribute("href", "https://wa.me/5511987654321");
  });

  it("shows 'WhatsApp não informado' when the customer has none", async () => {
    vi.mocked(ordersApi.listWorkOrdersPage).mockResolvedValue(
      paged([workOrder({ customer_whatsapp: "" })]),
    );
    renderPage();
    expect(await screen.findByText("WhatsApp não informado")).toBeInTheDocument();
  });

  it("debounces the search box and queries by the typed value", async () => {
    vi.mocked(ordersApi.listWorkOrdersPage).mockResolvedValue(paged([workOrder()]));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("OS 0001");
    await user.type(
      screen.getByPlaceholderText("Buscar por número, placa, cliente..."),
      "ABC",
    );
    await waitFor(() =>
      expect(ordersApi.listWorkOrdersPage).toHaveBeenLastCalledWith(1, {
        search: "ABC",
        active: "active",
        status: undefined,
      }),
    );
  });

  it("filters by a workflow status", async () => {
    vi.mocked(ordersApi.listWorkOrdersPage).mockResolvedValue(paged([workOrder()]));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("OS 0001");
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Em execução" }));
    await waitFor(() =>
      expect(ordersApi.listWorkOrdersPage).toHaveBeenLastCalledWith(1, {
        search: undefined,
        active: "active",
        status: "in_progress",
      }),
    );
  });

  it("switches to the disabled view and shows Reativar instead of Excluir", async () => {
    vi.mocked(ordersApi.listWorkOrdersPage).mockResolvedValue(paged([workOrder()]));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("OS 0001");
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Desabilitadas" }));
    await waitFor(() =>
      expect(ordersApi.listWorkOrdersPage).toHaveBeenLastCalledWith(1, {
        search: undefined,
        active: "inactive",
        status: undefined,
      }),
    );
    expect(screen.getByLabelText("Reativar OS")).toBeInTheDocument();
    expect(screen.queryByLabelText("Excluir OS")).not.toBeInTheDocument();
  });

  it("soft-deletes an OS through the confirm dialog", async () => {
    vi.mocked(ordersApi.listWorkOrdersPage).mockResolvedValue(paged([workOrder()]));
    vi.mocked(ordersApi.deleteWorkOrder).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("OS 0001");
    await user.click(screen.getByLabelText("Excluir OS"));
    await user.click(screen.getByRole("button", { name: "Excluir" }));
    await waitFor(() =>
      expect(ordersApi.deleteWorkOrder).toHaveBeenCalledWith(1, expect.anything()),
    );
  });
});
