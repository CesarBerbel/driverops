import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as financialApi from "@/features/financial/api";
import { ReportsPage } from "@/features/financial/pages/ReportsPage";
import type { DreReport, FinancialReport } from "@/features/financial/types";

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
    by_day: [{ date: "2026-07-06", total: "180.00" }],
    ...overrides,
  };
}

function dre(overrides: Partial<DreReport> = {}): DreReport {
  return {
    total_revenue: "180.00",
    total_expenses: "100.00",
    result: "80.00",
    expenses_by_category: [
      { category: "rent", category_display: "Aluguel", total: "100.00", count: 1 },
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
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(financialApi.getFinancialReport).mockResolvedValue(report());
    vi.mocked(financialApi.getDre).mockResolvedValue(dre());
  });

  it("shows the DRE tiles and both breakdowns", async () => {
    renderPage();
    // Resultado (receitas − despesas) e ticket médio.
    expect(await screen.findByText("R$ 80,00")).toBeInTheDocument();
    expect(screen.getByText("lucro no período")).toBeInTheDocument();
    expect(screen.getByText("Ticket médio")).toBeInTheDocument();
    // Quebras: por forma de pagamento e por categoria de despesa.
    expect(screen.getByText("Pix")).toBeInTheDocument();
    expect(screen.getByText("Aluguel")).toBeInTheDocument();
  });

  it("marks a negative result as prejuízo", async () => {
    vi.mocked(financialApi.getDre).mockResolvedValue(
      dre({ total_revenue: "0.00", total_expenses: "100.00", result: "-100.00" }),
    );
    vi.mocked(financialApi.getFinancialReport).mockResolvedValue(
      report({ total_received: "0.00", by_method: [], by_day: [] }),
    );
    renderPage();
    expect(await screen.findByText("prejuízo no período")).toBeInTheDocument();
  });

  it("shows an empty state when nothing happened", async () => {
    vi.mocked(financialApi.getFinancialReport).mockResolvedValue(
      report({ total_received: "0.00", by_method: [], by_day: [] }),
    );
    vi.mocked(financialApi.getDre).mockResolvedValue(
      dre({ total_revenue: "0.00", total_expenses: "0.00", result: "0.00", expenses_by_category: [] }),
    );
    renderPage();
    expect(await screen.findByText("Nenhum lançamento no período.")).toBeInTheDocument();
  });
});
