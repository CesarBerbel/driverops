import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { LeadMobileCard } from "@/features/leads/components/LeadMobileCard";
import type { LeadListItem } from "@/features/leads/types";

function lead(over: Partial<LeadListItem> = {}): LeadListItem {
  return {
    id: 42,
    name: "João Souza",
    phone: "11999998888",
    email: "joao@example.com",
    vehicle_plate: "ABC1D23",
    vehicle_brand: "VW",
    vehicle_model: "Gol",
    vehicle_year: 2020,
    request_type: "diagnostic",
    request_type_display: "Diagnóstico",
    best_period: "any",
    best_period_display: "Qualquer horário",
    desired_date: null,
    status: "new",
    status_display: "Novo",
    assigned_to: null,
    assigned_to_name: null,
    created_at: new Date().toISOString(),
    indicators: {
      customer_existing: false,
      vehicle_existing: true,
      vehicle_divergent: true,
      has_open_os: false,
    },
    ...over,
  };
}

describe("LeadMobileCard", () => {
  it("shows the requester name, request type, status and quick actions", () => {
    render(
      <MemoryRouter>
        <LeadMobileCard lead={lead()} />
      </MemoryRouter>,
    );
    expect(screen.getByText("João Souza")).toBeInTheDocument();
    expect(screen.getByText("Diagnóstico")).toBeInTheDocument();
    expect(screen.getByText("Novo")).toBeInTheDocument();
    // Indicadores.
    expect(screen.getByText("Cliente novo")).toBeInTheDocument();
    expect(screen.getByText("Veículo divergente")).toBeInTheDocument();
    // Ação principal abre o detalhe do pedido.
    expect(screen.getByRole("link", { name: "Ver pedido" })).toHaveAttribute(
      "href",
      "/leads/42",
    );
    // WhatsApp do solicitante.
    expect(screen.getByRole("link", { name: "WhatsApp" })).toHaveAttribute(
      "href",
      "https://wa.me/5511999998888",
    );
  });

  it("omits the WhatsApp action when there is no phone", () => {
    render(
      <MemoryRouter>
        <LeadMobileCard lead={lead({ phone: "" })} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("link", { name: "WhatsApp" })).not.toBeInTheDocument();
  });
});
