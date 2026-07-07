import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as financialApi from "@/features/financial/api";
import { ReportsPage } from "@/features/financial/pages/ReportsPage";
import type { FinancialReport } from "@/features/financial/types";

vi.mock("@/features/financial/api");

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({ user: { is_superuser: true, permissions: [] } }),
}));

function report(overrides: Partial<FinancialReport> = {}): FinancialReport {
  return {
    total_received: "180.00",
    payment_count: 3,
    orders_count: 2,
    average_ticket: "90.00",
    by_method: [
      { method: "pix", method_display: "Pix", total: "120.00", count: 2 },
      { method: "cash", method_display: "Dinheiro", total: "60.00", count: 1 },
    ],
    by_day: [
      { date: "2026-07-05", total: "120.00" },
      { date: "2026-07-06", total: "60.00" },
    ],
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ReportsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the KPI tiles and the payment-method breakdown", async () => {
    vi.mocked(financialApi.getFinancialReport).mockResolvedValue(report());
    renderPage();
    // Total recebido + ticket médio nos tiles.
    expect(await screen.findByText("R$ 180,00")).toBeInTheDocument();
    expect(screen.getByText("Ticket médio")).toBeInTheDocument();
    expect(screen.getByText("R$ 90,00")).toBeInTheDocument();
    // Quebra por forma de pagamento.
    expect(screen.getByText("Pix")).toBeInTheDocument();
    expect(screen.getByText("Dinheiro")).toBeInTheDocument();
    expect(screen.getByText("R$ 120,00")).toBeInTheDocument();
  });

  it("shows an empty state when nothing was received", async () => {
    vi.mocked(financialApi.getFinancialReport).mockResolvedValue(
      report({
        total_received: "0.00",
        payment_count: 0,
        orders_count: 0,
        average_ticket: "0.00",
        by_method: [],
        by_day: [],
      }),
    );
    renderPage();
    expect(
      await screen.findByText("Nenhum recebimento no período."),
    ).toBeInTheDocument();
  });
});
