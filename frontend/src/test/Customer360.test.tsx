import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import { Customer360Page } from "@/features/customer360/pages/Customer360Page";
import type { Customer360 } from "@/features/customer360/types";

vi.mock("@/features/customer360/api", () => ({
  getCustomer360: vi.fn(),
  getCustomerOrders: vi.fn(),
  getCustomerQuotes: vi.fn(),
  getCustomerInteractions: vi.fn(),
  createInteraction: vi.fn(),
  getCustomerFinancial: vi.fn(),
  getCustomerTimeline: vi.fn(),
}));
import * as api from "@/features/customer360/api";

function data(over: Partial<Customer360> = {}): Customer360 {
  return {
    customer: {
      id: 5,
      name: "Maria Silva",
      customer_type: "individual",
      customer_type_display: "Pessoa Física",
      email: "maria@example.com",
      phone: "11988887777",
      whatsapp: "11988887777",
      document: "",
      address_line: "Rua A, 10 — São Paulo/SP",
      city: "São Paulo",
      state: "SP",
      notes: "",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    summary: {
      vehicles: 2,
      open_os: 1,
      finished_os: 3,
      pending_quotes: 1,
      approved_quotes: 2,
      total_value: "1000.00",
      open_value: "180.00",
      last_visit: new Date().toISOString(),
      last_interaction: new Date().toISOString(),
      pending_count: 2,
    },
    alerts: [{ type: "open_os", severity: "info", message: "1 OS em aberto.", link: "" }],
    vehicles: [{ id: 1, license_plate: "ABC1D23", brand: "VW", model: "Gol", model_year: 2020 }],
    open_orders: [
      {
        id: 9,
        number: 42,
        status: "in_progress",
        status_display: "Em execução",
        opened_at: "2026-07-01",
        expected_delivery: null,
        vehicle_plate: "ABC1D23",
        customer_report: "barulho",
        final_value: "500.00",
        balance_due: "180.00",
        is_overdue: false,
      },
    ],
    last_finished_order: null,
    pending_quotes: [],
    recent_interactions: [],
    crm_count: 0,
    can_financial: true,
    can_interactions: true,
    ...over,
  };
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/customers/5/360"]}>
        <Routes>
          <Route path="/customers/:id/360" element={<Customer360Page />} />
        </Routes>
      </MemoryRouter>
      <Toaster />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(api.getCustomer360).mockResolvedValue(data());
  vi.mocked(api.getCustomerInteractions).mockResolvedValue([]);
  vi.mocked(api.createInteraction).mockResolvedValue({} as never);
  vi.mocked(api.getCustomerFinancial).mockResolvedValue({
    total_value: "1000.00",
    paid_value: "820.00",
    open_value: "180.00",
    orders_with_balance: 1,
    payments: [],
  });
});

describe("Cliente 360°", () => {
  it("renders the header, summary and alerts", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Maria Silva" })).toBeInTheDocument();
    expect(screen.getByText(/OS #42/)).toBeInTheDocument();
    expect(screen.getByText("1 OS em aberto.")).toBeInTheDocument();
    // Ação rápida de WhatsApp.
    expect(screen.getByRole("link", { name: /WhatsApp/ })).toBeInTheDocument();
  });

  it("shows the financial tab only when authorized", async () => {
    vi.mocked(api.getCustomer360).mockResolvedValue(data({ can_financial: false, summary: { ...data().summary, total_value: null, open_value: null } }));
    renderPage();
    await screen.findByRole("heading", { name: "Maria Silva" });
    expect(screen.queryByRole("button", { name: "Financeiro" })).not.toBeInTheDocument();
  });

  it("lazy-loads the financial tab when authorized", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Maria Silva" });
    await userEvent.click(screen.getByRole("button", { name: "Financeiro" }));
    await waitFor(() => expect(api.getCustomerFinancial).toHaveBeenCalledWith(5));
    expect(await screen.findByText("R$ 820.00")).toBeInTheDocument();
  });

  it("registers an interaction", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Maria Silva" });
    await userEvent.click(screen.getByRole("button", { name: "Interações" }));
    await waitFor(() => expect(api.getCustomerInteractions).toHaveBeenCalledWith(5));
    await userEvent.type(
      screen.getByPlaceholderText(/Resumo da interação/),
      "Cliente pediu retorno amanhã",
    );
    await userEvent.click(screen.getByRole("button", { name: "Registrar" }));
    await waitFor(() =>
      expect(api.createInteraction).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ summary: "Cliente pediu retorno amanhã" }),
      ),
    );
  });

  it("dismisses an alert (it stays hidden during the visit)", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Maria Silva" });
    expect(screen.getByText("1 OS em aberto.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Dispensar aviso" }));
    expect(screen.queryByText("1 OS em aberto.")).not.toBeInTheDocument();
  });

  it("shows an error state", async () => {
    vi.mocked(api.getCustomer360).mockRejectedValue(new Error("fail"));
    renderPage();
    expect(await screen.findByText("Não foi possível carregar o cliente.")).toBeInTheDocument();
  });
});
