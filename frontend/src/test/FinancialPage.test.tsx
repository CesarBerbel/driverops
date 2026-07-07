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

function receivable(): WorkOrder {
  return {
    id: 7,
    number: 7,
    customer_name: "Maria Silva",
    vehicle_plate: "ABC1234",
    final_value: "160.00",
    amount_paid: "100.00",
    balance_due: "60.00",
    payment_status: "partial",
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
});
