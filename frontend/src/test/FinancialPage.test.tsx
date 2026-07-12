import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as financialApi from "@/features/financial/api";
import { FinancialPage } from "@/features/financial/pages/FinancialPage";
import type { WorkOrder } from "@/features/orders/types";

vi.mock("@/features/financial/api");

const auth = vi.hoisted(() => ({
  user: { is_superuser: true, permissions: [] as string[] },
}));
vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({ user: auth.user }),
}));

function receivable(over: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: 7,
    number: 7,
    customer_name: "Maria Silva",
    vehicle_plate: "ABC1234",
    final_value: "160.00",
    amount_paid: "100.00",
    balance_due: "60.00",
    payment_status: "partial",
    payment_due_date: null,
    aging_bucket: "no_due_date",
    aging_bucket_display: "Sem vencimento",
    days_overdue: 0,
    is_overdue: false,
    ...over,
  } as unknown as WorkOrder;
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <FinancialPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("FinancialPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(financialApi.listReceivables).mockResolvedValue({
      count: 1,
      total_receivable: "60.00",
      total_overdue: "0.00",
      aging_summary: [],
      results: [receivable()],
    });
    vi.mocked(financialApi.listPayments).mockResolvedValue([]);
  });

  it("shows the total receivable and the receivables row", async () => {
    renderPage();
    expect(await screen.findByText("Maria Silva")).toBeInTheDocument();
    // Total a receber + saldo da linha.
    expect(screen.getAllByText("R$ 60,00").length).toBeGreaterThan(0);
    expect(screen.getByText("Parcial")).toBeInTheDocument();
  });

  it("opens the payment dialog for a receivable", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Maria Silva");
    await user.click(screen.getByRole("button", { name: "Pagamentos" }));
    // O diálogo mostra o número da OS e o cliente/placa.
    expect(await screen.findByText(/Maria Silva · ABC1234/)).toBeInTheDocument();
  });

  it("shows the overdue badge, the due date and the total overdue card", async () => {
    vi.mocked(financialApi.listReceivables).mockResolvedValue({
      count: 1,
      total_receivable: "60.00",
      total_overdue: "60.00",
      aging_summary: [],
      results: [
        receivable({
          payment_due_date: "2026-01-10",
          aging_bucket: "overdue_31_60",
          aging_bucket_display: "Vencido (31–60 dias)",
          days_overdue: 40,
          is_overdue: true,
        }),
      ],
    });
    renderPage();
    expect(await screen.findByText("Vencido há 40 dias")).toBeInTheDocument();
    expect(screen.getByText("10/01/2026")).toBeInTheDocument();
    // Card "Vencido" no topo com o valor.
    expect(screen.getByText("Vencido")).toBeInTheDocument();
  });

  it("filters by overdue only", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Maria Silva");
    await user.click(screen.getByRole("button", { name: /só vencidas/i }));
    expect(financialApi.listReceivables).toHaveBeenCalledWith(
      expect.objectContaining({ overdue: true }),
    );
  });
});
