import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as partsApi from "@/features/parts/api";
import { StockMovementDialog } from "@/features/parts/components/StockMovementDialog";
import type { Part, StockMovement } from "@/features/parts/types";

vi.mock("@/features/parts/api");

const auth = vi.hoisted(() => ({
  user: { is_superuser: false, permissions: [] as string[] },
}));
vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({ user: auth.user }),
}));

function part(overrides: Partial<Part> = {}): Part {
  return {
    id: 7,
    category: 1,
    category_name: "Motor",
    name: "Filtro de óleo",
    internal_code: "",
    brand: "",
    model_application: "",
    unit_of_measure: "unit",
    current_quantity: "10.00",
    min_quantity: null,
    cost_price: null,
    sale_price: null,
    location: "",
    supplier: null,
    supplier_name: null,
    ncm: "",
    barcode: "",
    notes: "",
    is_low_stock: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function movement(overrides: Partial<StockMovement> = {}): StockMovement {
  return {
    id: 1,
    part: 7,
    kind: "in",
    kind_display: "Entrada",
    quantity: "10.00",
    resulting_quantity: "20.00",
    reason: "compra",
    order: null,
    order_number: null,
    created_by: 1,
    created_by_name: "Admin",
    created_at: "2026-07-05T12:00:00Z",
    ...overrides,
  };
}

function renderDialog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <StockMovementDialog open onOpenChange={() => {}} part={part()} />
    </QueryClientProvider>,
  );
}

describe("StockMovementDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user = { is_superuser: false, permissions: [] };
    vi.mocked(partsApi.listStockMovements).mockResolvedValue([movement()]);
    vi.mocked(partsApi.createStockMovement).mockResolvedValue(
      movement({ id: 2, kind: "out", quantity: "3.00", resulting_quantity: "7.00" }),
    );
  });

  it("shows the current balance and the movement history", async () => {
    renderDialog();
    expect(screen.getByText(/saldo atual:/)).toBeInTheDocument();
    expect(await screen.findByText(/Entrada de 10/)).toBeInTheDocument();
    expect(screen.getByText(/saldo: 20/)).toBeInTheDocument();
  });

  it("lets a user with stock_move submit an entrada", async () => {
    auth.user = { is_superuser: false, permissions: ["parts.stock_move"] };
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText("Quantidade"), "3");
    await user.click(screen.getByRole("button", { name: /Lançar movimentação/ }));

    await waitFor(() => expect(partsApi.createStockMovement).toHaveBeenCalledTimes(1));
    expect(partsApi.createStockMovement).toHaveBeenCalledWith(7, {
      kind: "in",
      quantity: "3",
      reason: "",
    });
  });

  it("hides the form for a view-only user", async () => {
    auth.user = { is_superuser: false, permissions: ["parts.view"] };
    renderDialog();
    expect(
      screen.getByText(/não tem permissão para movimentar o estoque/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Lançar movimentação/ })).toBeNull();
  });
});
