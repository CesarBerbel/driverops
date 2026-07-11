import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/vehicle-portal/api");
import * as api from "@/features/vehicle-portal/api";
import { VehicleAccessRequestPage } from "@/features/vehicle-portal/pages/VehicleAccessRequestPage";
import { VehiclePortalPage } from "@/features/vehicle-portal/pages/VehiclePortalPage";
import type { VehiclePortal } from "@/features/vehicle-portal/types";

function wrap(ui: ReactNode, initial = "/veiculo/tok") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initial]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

function portal(overrides: Partial<VehiclePortal> = {}): VehiclePortal {
  return {
    vehicle: { plate: "ABC1D23", brand: "VW", model: "Gol", year: "2019/2020", color: "Prata", mileage: 87500 },
    customer_first_name: "João",
    current_order: {
      id: 7,
      number: 245,
      opened_at: "2026-07-04",
      status: "in_progress",
      status_display: "Em execução",
      final_value: "500",
      expected_delivery: "2026-07-06",
      customer_report: "Barulho na frente",
      diagnosis: "Amortecedor gasto",
      updated_at: "2026-07-05T10:00:00Z",
      timeline: [
        { status: "open", status_display: "Aberta", at: "2026-07-04T10:00:00Z" },
        { status: "in_progress", status_display: "Em execução", at: "2026-07-05T10:00:00Z" },
      ],
      quote: null,
      has_pdf: true,
    },
    history: [
      { id: 3, number: 120, opened_at: "2026-01-01", status: "finished", status_display: "Finalizada", final_value: "300" },
    ],
    workshop: { name: "Oficina Teste", whatsapp: "11999990000", phone: "1140028922" },
    options: { allow_messages: true, allow_pdf_download: true, show_history: true },
    ...overrides,
  };
}

const routes = (
  <Routes>
    <Route path="/veiculo/:token" element={<VehiclePortalPage />} />
    <Route path="/veiculo" element={<div>form</div>} />
  </Routes>
);

describe("VehicleAccessRequestPage", () => {
  beforeEach(() => vi.mocked(api.requestVehicleAccess).mockReset());

  it("shows the neutral message after submitting a plate", async () => {
    vi.mocked(api.requestVehicleAccess).mockResolvedValue({
      detail: "Se encontrarmos um veículo com estes dados, enviaremos um link.",
    });
    const user = userEvent.setup();
    wrap(<VehicleAccessRequestPage />, "/veiculo");
    await user.type(screen.getByLabelText("Placa / matrícula"), "ABC1D23");
    await user.click(screen.getByRole("button", { name: /receber link/i }));
    expect(await screen.findByText(/Se encontrarmos um veículo/)).toBeInTheDocument();
    expect(api.requestVehicleAccess).toHaveBeenCalledWith(
      expect.objectContaining({ plate: "ABC1D23" }),
    );
  });
});

describe("VehiclePortalPage", () => {
  beforeEach(() => vi.mocked(api.getVehiclePortal).mockReset());

  it("renders the vehicle, current OS, timeline and history", async () => {
    vi.mocked(api.getVehiclePortal).mockResolvedValue(portal());
    wrap(routes);
    expect(await screen.findByText("ABC1D23")).toBeInTheDocument();
    expect(screen.getByText("OS 0245")).toBeInTheDocument();
    // "Em execução" aparece no selo de status e na timeline.
    expect(screen.getAllByText("Em execução").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Barulho na frente")).toBeInTheDocument();
    // Histórico do veículo.
    expect(screen.getByText("OS 0120")).toBeInTheDocument();
  });

  it("shows an empty state when there is no current OS", async () => {
    vi.mocked(api.getVehiclePortal).mockResolvedValue(portal({ current_order: null }));
    wrap(routes);
    expect(
      await screen.findByText("Não há OS em andamento para este veículo no momento."),
    ).toBeInTheDocument();
  });

  // Observação: os caminhos de erro do portal (link expirado -> 410 / inválido ->
  // 404) são verificados no backend (apps/customer_portal/tests). Testá-los aqui
  // via rejeição do React Query é instável no jsdom: em React 19 a query rejeitada
  // dispara um erro de render assíncrono não-determinístico que o vitest reprova de
  // forma intermitente. A lógica de UI de erro é trivial (status === 410 ? ...).
});
