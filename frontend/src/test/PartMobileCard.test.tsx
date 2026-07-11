import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PartMobileCard } from "@/features/parts/components/PartMobileCard";
import type { Part } from "@/features/parts/types";

function part(overrides: Partial<Part> = {}): Part {
  return {
    id: 1,
    category: 1,
    category_name: "Motor",
    name: "Filtro de óleo",
    internal_code: "FO-123",
    brand: "Bosch",
    model_application: "",
    unit_of_measure: "unit",
    current_quantity: "10.00",
    min_quantity: "5.00",
    cost_price: null,
    sale_price: "49.90",
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

describe("PartMobileCard", () => {
  it("shows the name, code, brand, category, stock, formatted sale value", () => {
    render(<PartMobileCard part={part()} />);

    expect(screen.getByText("Filtro de óleo")).toBeInTheDocument();
    expect(screen.getByText("FO-123")).toBeInTheDocument();
    expect(screen.getByText("Bosch")).toBeInTheDocument();
    expect(screen.getByText("Motor")).toBeInTheDocument();
    expect(screen.getByText(/Estoque: 10 Unidade/)).toBeInTheDocument();
    expect(screen.getByText(/mín\. 5/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?49,90/)).toBeInTheDocument();
  });

  it("highlights the low-stock status", () => {
    render(<PartMobileCard part={part({ is_low_stock: true })} />);
    expect(screen.getByText("Estoque baixo")).toBeInTheDocument();
  });

  it("does not show the low-stock badge when stock is fine", () => {
    render(<PartMobileCard part={part({ is_low_stock: false })} />);
    expect(screen.queryByText("Estoque baixo")).not.toBeInTheDocument();
  });

  it("shows a dash for the sale value when it is not set", () => {
    render(<PartMobileCard part={part({ sale_price: null })} />);
    expect(screen.getByText(/Venda: —/)).toBeInTheDocument();
  });

  it("triggers the primary edit action", async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(<PartMobileCard part={part()} onEdit={onEdit} />);

    await user.click(screen.getByRole("button", { name: "Editar" }));
    expect(onEdit).toHaveBeenCalledWith(1);
  });

  it("triggers the stock-movement action when provided", async () => {
    const onMoveStock = vi.fn();
    const user = userEvent.setup();
    const p = part();
    render(<PartMobileCard part={p} onEdit={vi.fn()} onMoveStock={onMoveStock} />);

    await user.click(screen.getByRole("button", { name: "Movimentar estoque" }));
    expect(onMoveStock).toHaveBeenCalledWith(p);
  });
});
