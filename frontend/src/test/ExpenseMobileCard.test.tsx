import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ExpenseMobileCard } from "@/features/financial/components/ExpenseMobileCard";
import type { Expense } from "@/features/financial/types";

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

describe("ExpenseMobileCard", () => {
  it("shows the description, formatted value, date, category and method", () => {
    render(<ExpenseMobileCard expense={expense()} />);
    expect(screen.getByText("Aluguel julho")).toBeInTheDocument();
    expect(screen.getByText("R$ 2.000,00")).toBeInTheDocument();
    expect(screen.getByText("06/07/2026")).toBeInTheDocument();
    expect(screen.getByText("Aluguel")).toBeInTheDocument();
    expect(screen.getByText("Transferência")).toBeInTheDocument();
  });

  it("calls onEdit (primary action) with the expense", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<ExpenseMobileCard expense={expense()} onEdit={onEdit} />);
    await user.click(screen.getByRole("button", { name: "Editar despesa" }));
    expect(onEdit).toHaveBeenCalledWith(expense());
  });

  it("omits the actions when no handlers are passed", () => {
    render(<ExpenseMobileCard expense={expense()} />);
    expect(screen.queryByRole("button", { name: "Editar despesa" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Excluir despesa" })).toBeNull();
  });
});
