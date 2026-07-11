import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { CustomerMobileCard } from "@/features/customers/components/CustomerMobileCard";
import type { Customer } from "@/features/customers/types";

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 42,
    name: "Maria Souza",
    customer_type: "individual",
    email: "maria@example.com",
    phone: "",
    whatsapp: "11987654321",
    document: "",
    zip_code: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "São Paulo",
    state: "SP",
    country: "Brasil",
    notes: "",
    is_active: true,
    vehicle_count: 2,
    created_at: "2026-07-04T00:00:00Z",
    updated_at: "2026-07-04T00:00:00Z",
    ...overrides,
  };
}

describe("CustomerMobileCard", () => {
  it("shows the name, formatted phone and quick actions", () => {
    render(
      <MemoryRouter>
        <CustomerMobileCard customer={customer()} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Maria Souza")).toBeInTheDocument();
    // Aparece na linha de contato e no sr-only do botão de WhatsApp.
    expect(screen.getAllByText("(11) 98765-4321").length).toBeGreaterThan(0);

    const ver360 = screen.getByRole("link", { name: "Ver 360°" });
    expect(ver360).toHaveAttribute("href", "/customers/42/360");

    expect(screen.getByRole("link", { name: "WhatsApp" })).toHaveAttribute(
      "href",
      "https://wa.me/5511987654321",
    );
  });

  it("omits the WhatsApp action when there is no phone", () => {
    render(
      <MemoryRouter>
        <CustomerMobileCard customer={customer({ phone: "", whatsapp: "" })} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("link", { name: "WhatsApp" })).not.toBeInTheDocument();
  });
});
