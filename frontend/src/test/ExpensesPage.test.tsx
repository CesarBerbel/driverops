import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as financialApi from "@/features/financial/api";
import { ExpensesPage } from "@/features/financial/pages/ExpensesPage";
import type { Expense } from "@/features/financial/types";

vi.mock("@/features/financial/api");

const auth = vi.hoisted(() => ({
  user: { is_superuser: false, permissions: [] as string[] },
}));
vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({ user: auth.user }),
}));

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 1,
    description: "Aluguel julho",
    category: "rent",
    category_display: "Aluguel",
    amount: "2000.00",
    method: "transfer",
    method_display: "Transferência",
    incurred_at: "2026-07-06",
    note: "",
    created_by_name: "Admin",
    created_at: "2026-07-06T12:00:00Z",
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ExpensesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ExpensesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user = { is_superuser: false, permissions: ["financial.view", "financial.register_expense"] };
    vi.mocked(financialApi.listExpenses).mockResolvedValue([expense()]);
  });

  it("lists expenses and the period total", async () => {
    renderPage();
    expect(await screen.findByText("Aluguel julho")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 2.000,00").length).toBeGreaterThan(0);
  });

  it("opens the new-expense dialog", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Aluguel julho");
    await user.click(screen.getByRole("button", { name: /Nova despesa/ }));
    expect(await screen.findByRole("heading", { name: "Nova despesa" })).toBeInTheDocument();
  });

  it("hides create/edit/delete for a view-only user", async () => {
    auth.user = { is_superuser: false, permissions: ["financial.view"] };
    renderPage();
    await screen.findByText("Aluguel julho");
    expect(screen.queryByRole("button", { name: /Nova despesa/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Excluir despesa/ })).toBeNull();
  });
});
