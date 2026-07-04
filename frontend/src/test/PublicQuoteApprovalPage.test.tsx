import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PublicQuoteApprovalPage } from "@/features/quotes/pages/PublicQuoteApprovalPage";
import * as quotesApi from "@/features/quotes/api";
import type { PublicQuote } from "@/features/quotes/types";

vi.mock("@/features/quotes/api");

function publicQuote(overrides: Partial<PublicQuote> = {}): PublicQuote {
  return {
    number: 3,
    version: 1,
    status: "sent",
    status_display: "Enviado",
    can_decide: true,
    work_order_number: 10,
    customer_name: "André Carvalho",
    vehicle_plate: "NVS1A18",
    vehicle_description: "Nissan Versa 1.6",
    customer_report: "Troca de velas",
    diagnosis: "Velas gastas",
    valid_until: "2026-07-11",
    discount_type: "none",
    items: [
      {
        kind: "service",
        kind_display: "Serviço",
        description: "Substituição de velas",
        quantity: "1",
        unit_price: "160.00",
        subtotal: "160.00",
        is_custom: false,
        notes: "",
      },
    ],
    totals: {
      services_total: "160.00",
      packages_total: "0.00",
      parts_total: "0.00",
      gross_total: "160.00",
      discount_value: "0.00",
      final_value: "160.00",
    },
    client_name: "",
    decided_at: null,
    rejection_reason: "",
    workshop: {
      trade_name: "Auto Mecânica",
      legal_name: "",
      cnpj: "",
      phone: "1133334444",
      whatsapp: "",
      email: "oficina@example.com",
      city: "",
      state: "",
      logo: null,
    },
    terms: {
      quote_terms: "Validade de 7 dias.",
      warranty_terms: "Garantia de 90 dias.",
      service_authorization_terms: "Autorizo a execução.",
    },
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/orcamento/tok123"]}>
        <Routes>
          <Route path="/orcamento/:token" element={<PublicQuoteApprovalPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PublicQuoteApprovalPage", () => {
  beforeEach(() => {
    vi.mocked(quotesApi.getPublicQuote).mockReset();
    vi.mocked(quotesApi.approvePublicQuote).mockReset();
    vi.mocked(quotesApi.rejectPublicQuote).mockReset();
  });

  it("shows the quote data, items and final value", async () => {
    vi.mocked(quotesApi.getPublicQuote).mockResolvedValue(publicQuote());
    renderPage();
    expect(await screen.findByText("Auto Mecânica")).toBeInTheDocument();
    expect(screen.getByText("André Carvalho")).toBeInTheDocument();
    expect(screen.getByText("Substituição de velas")).toBeInTheDocument();
    expect(screen.getByText("Validade de 7 dias.")).toBeInTheDocument();
    // Final value appears (currency formatted).
    expect(screen.getAllByText("R$ 160,00").length).toBeGreaterThan(0);
  });

  it("blocks approval until name and terms are provided", async () => {
    vi.mocked(quotesApi.getPublicQuote).mockResolvedValue(publicQuote());
    const user = userEvent.setup();
    renderPage();

    const approve = await screen.findByRole("button", { name: /Aprovar orçamento/ });
    expect(approve).toBeDisabled();

    await user.type(screen.getByLabelText("Seu nome"), "André Carvalho");
    await user.click(screen.getByRole("checkbox"));
    expect(approve).toBeEnabled();
  });

  it("approves after confirming (calls the public approve endpoint)", async () => {
    vi.mocked(quotesApi.getPublicQuote).mockResolvedValue(publicQuote());
    vi.mocked(quotesApi.approvePublicQuote).mockResolvedValue(
      publicQuote({ status: "approved", can_decide: false, client_name: "André Carvalho" }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText("Seu nome"), "André Carvalho");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /Aprovar orçamento/ }));
    // Confirmation dialog
    await user.click(screen.getByRole("button", { name: "Confirmar aprovação" }));

    await waitFor(() =>
      expect(quotesApi.approvePublicQuote).toHaveBeenCalledWith("tok123", {
        client_name: "André Carvalho",
        terms_accepted: true,
      }),
    );
  });

  it("shows an approved banner and no actions when already decided", async () => {
    vi.mocked(quotesApi.getPublicQuote).mockResolvedValue(
      publicQuote({ status: "approved", can_decide: false, client_name: "André" }),
    );
    renderPage();
    expect(await screen.findByText(/Orçamento aprovado/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Aprovar orçamento/ }),
    ).not.toBeInTheDocument();
  });

  it("shows an error message when the link is invalid", async () => {
    vi.mocked(quotesApi.getPublicQuote).mockRejectedValue(new Error("404"));
    renderPage();
    expect(await screen.findByText("Link inválido ou expirado")).toBeInTheDocument();
  });
});
