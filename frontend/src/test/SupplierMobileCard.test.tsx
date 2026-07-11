import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SupplierMobileCard } from "@/features/suppliers/components/SupplierMobileCard";
import type { Supplier } from "@/features/suppliers/types";

function supplier(overrides: Partial<Supplier> = {}): Supplier {
  return {
    id: 3,
    name: "Fornecedor Ltda",
    trade_name: "Peças Silva",
    supplier_type: "company",
    document: "12345678000199",
    state_registration: "",
    email: "contato@pecas.com",
    phone: "",
    whatsapp: "11912345678",
    contact_name: "",
    zip_code: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "São Paulo",
    state: "SP",
    country: "Brasil",
    notes: "",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("SupplierMobileCard", () => {
  it("shows the supplier name and triggers the edit action", async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(<SupplierMobileCard supplier={supplier()} onEdit={onEdit} />);

    expect(screen.getByText("Fornecedor Ltda")).toBeInTheDocument();
    expect(screen.getByText("Peças Silva")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Editar" }));
    expect(onEdit).toHaveBeenCalledWith(3);
  });

  it("links to WhatsApp when there is a phone/whatsapp", () => {
    render(<SupplierMobileCard supplier={supplier()} />);
    expect(screen.getByRole("link", { name: "WhatsApp" })).toHaveAttribute(
      "href",
      "https://wa.me/5511912345678",
    );
  });

  it("omits the WhatsApp action when there is no phone", () => {
    render(<SupplierMobileCard supplier={supplier({ phone: "", whatsapp: "" })} />);
    expect(screen.queryByRole("link", { name: "WhatsApp" })).not.toBeInTheDocument();
  });
});
