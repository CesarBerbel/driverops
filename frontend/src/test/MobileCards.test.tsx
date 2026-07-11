import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const isMobile = vi.fn();
vi.mock("@/lib/useIsMobile", () => ({ useIsMobile: () => isMobile() }));

import { ResponsiveDataView } from "@/components/shared/ResponsiveDataView";
import { OrderMobileCard } from "@/features/orders/components/OrderMobileCard";
import type { WorkOrder } from "@/features/orders/types";

function order(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: 7,
    number: 245,
    customer: 1,
    customer_name: "João Silva",
    customer_whatsapp: "11912345678",
    customer_phone: "",
    vehicle: 1,
    vehicle_plate: "ABC1234",
    vehicle_description: "Honda Civic",
    status: "in_progress",
    status_display: "Em execução",
    assigned_technician: 2,
    assigned_technician_name: "Carlos",
    opened_at: "2026-07-04",
    expected_delivery: "2026-07-06",
    current_mileage: 1000,
    customer_report: "",
    diagnosis: "",
    internal_notes: "",
    service_items: [],
    package_items: [],
    part_items: [],
    discount_type: "none",
    discount_value: "0",
    services_total: "0",
    packages_total: "0",
    parts_total: "0",
    gross_total: "500",
    final_value: "500",
    amount_paid: "0",
    balance_due: "500",
    payment_status: "open",
    quote_status: null,
    quote_status_display: null,
    created_at: "2026-07-04T00:00:00Z",
    updated_at: "2026-07-04T00:00:00Z",
    ...overrides,
  } as WorkOrder;
}

describe("OrderMobileCard", () => {
  it("shows the OS number, customer, vehicle, status, value and quick actions", () => {
    render(
      <MemoryRouter>
        <OrderMobileCard order={order()} />
      </MemoryRouter>,
    );
    expect(screen.getByText("OS 0245")).toBeInTheDocument();
    expect(screen.getByText(/João Silva/)).toBeInTheDocument();
    expect(screen.getByText(/Honda Civic \(ABC1234\)/)).toBeInTheDocument();
    expect(screen.getByText("Em execução")).toBeInTheDocument();
    expect(screen.getByText(/R\$ 500,00 · Em aberto/)).toBeInTheDocument();
    // Ver OS aponta para a OS (o orçamento vive dentro dela).
    const verOs = screen.getByRole("link", { name: "Ver OS" });
    expect(verOs).toHaveAttribute("href", "/orders/7");
    // WhatsApp do cliente.
    expect(screen.getByRole("link", { name: "WhatsApp" })).toHaveAttribute(
      "href",
      "https://wa.me/5511912345678",
    );
  });

  it("omits the WhatsApp action when there is no phone", () => {
    render(
      <MemoryRouter>
        <OrderMobileCard order={order({ customer_whatsapp: "", customer_phone: "" })} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("link", { name: "WhatsApp" })).not.toBeInTheDocument();
  });

  it("shows the OS quote (orçamento) status when applicable", () => {
    render(
      <MemoryRouter>
        <OrderMobileCard
          order={order({
            quote_status: "partially_approved",
            quote_status_display: "Aprovado parcialmente",
          })}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("Orçamento: Aprovado parcialmente")).toBeInTheDocument();
  });

  it("hides the quote line when the OS has no quote", () => {
    render(
      <MemoryRouter>
        <OrderMobileCard order={order()} />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/Orçamento:/)).not.toBeInTheDocument();
  });
});

describe("ResponsiveDataView", () => {
  beforeEach(() => isMobile.mockReset());

  it("renders the table on desktop", () => {
    isMobile.mockReturnValue(false);
    render(
      <ResponsiveDataView
        items={[{ id: 1 }]}
        getKey={(i) => i.id}
        renderCard={() => <span>CARD</span>}
        table={<span>TABELA</span>}
      />,
    );
    expect(screen.getByText("TABELA")).toBeInTheDocument();
    expect(screen.queryByText("CARD")).not.toBeInTheDocument();
  });

  it("renders cards on mobile", () => {
    isMobile.mockReturnValue(true);
    render(
      <ResponsiveDataView
        items={[{ id: 1 }, { id: 2 }]}
        getKey={(i) => i.id}
        renderCard={(i) => <span>CARD-{i.id}</span>}
        table={<span>TABELA</span>}
      />,
    );
    expect(screen.queryByText("TABELA")).not.toBeInTheDocument();
    expect(screen.getByText("CARD-1")).toBeInTheDocument();
    expect(screen.getByText("CARD-2")).toBeInTheDocument();
  });
});
