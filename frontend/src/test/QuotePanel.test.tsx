import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import { QuotePanel } from "@/features/quotes/components/QuotePanel";
import * as quotesApi from "@/features/quotes/api";
import type { Quote } from "@/features/quotes/types";

vi.mock("@/features/quotes/api");

function quote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: 1,
    number: 1,
    version: 1,
    status: "draft",
    status_display: "Rascunho",
    work_order: 10,
    work_order_number: 10,
    customer_name: "André Carvalho",
    customer_email: "andre@example.com",
    vehicle_plate: "NVS1A18",
    customer_report: "",
    diagnosis: "",
    discount_type: "none",
    discount_value: "0.00",
    valid_until: null,
    public_token: "tok123",
    items: [
      {
        id: 1,
        kind: "service",
        kind_display: "Serviço",
        description: "Troca de óleo",
        quantity: "1",
        unit_price: "160.00",
        subtotal: "160.00",
        is_custom: false,
        notes: "",
        status: "pending",
        status_display: "Pendente",
        linked_service: null,
      },
    ],
    totals: {
      services_total: "160.00",
      packages_total: "0.00",
      parts_total: "0.00",
      gross_total: "160.00",
      total_quoted: "160.00",
      total_approved: "0.00",
      total_rejected: "0.00",
      total_pending: "160.00",
      discount_value: "0.00",
      final_value: "160.00",
    },
    created_by_name: "Admin",
    created_at: "2026-07-05T00:00:00Z",
    sent_at: null,
    sent_to_email: "",
    viewed_at: null,
    decided_at: null,
    approval_channel: "",
    channel_display: "",
    approved_by_name: "",
    client_name: "",
    terms_accepted: false,
    rejection_reason: "",
    approval_note: "",
    decision_ip: null,
    decision_user_agent: "",
    signature_image: null,
    signed_document: null,
    ...overrides,
  };
}

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <QuotePanel orderId={10} />
      <Toaster />
    </QueryClientProvider>,
  );
}

describe("QuotePanel", () => {
  beforeEach(() => {
    vi.mocked(quotesApi.listQuotes).mockReset();
    vi.mocked(quotesApi.createQuote).mockReset();
    vi.mocked(quotesApi.approveQuotePhysical).mockReset();
  });

  it("lists the quotes with status and final value", async () => {
    vi.mocked(quotesApi.listQuotes).mockResolvedValue([quote()]);
    renderPanel();
    expect(await screen.findByText("Orçamento 0001")).toBeInTheDocument();
    expect(screen.getByText("Rascunho")).toBeInTheDocument();
    expect(screen.getByText("R$ 160,00")).toBeInTheDocument();
  });

  it("shows an empty state and creates a quote from the OS", async () => {
    vi.mocked(quotesApi.listQuotes).mockResolvedValue([]);
    vi.mocked(quotesApi.createQuote).mockResolvedValue(quote());
    const user = userEvent.setup();
    renderPanel();

    expect(await screen.findByText(/Nenhum orçamento gerado ainda/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Criar orçamento" }));
    await waitFor(() => expect(quotesApi.createQuote).toHaveBeenCalledWith(10));
  });

  it("approves presencialmente (assinatura física) after confirming", async () => {
    vi.mocked(quotesApi.listQuotes).mockResolvedValue([quote()]);
    vi.mocked(quotesApi.approveQuotePhysical).mockResolvedValue(
      quote({ status: "approved", status_display: "Aprovado" }),
    );
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("button", { name: "Aprovar presencial" }));
    await user.click(await screen.findByRole("button", { name: "Registrar decisão" }));

    await waitFor(() =>
      expect(quotesApi.approveQuotePhysical).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          client_name: "André Carvalho",
          approved_item_ids: [1],
        }),
      ),
    );
  });

  it("registers a partial approval (rejecting an item) via the physical dialog", async () => {
    vi.mocked(quotesApi.listQuotes).mockResolvedValue([quote()]);
    vi.mocked(quotesApi.approveQuotePhysical).mockResolvedValue(
      quote({ status: "partially_approved", status_display: "Aprovado parcialmente" }),
    );
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("button", { name: "Aprovar presencial" }));
    // Recusa o único item -> approved_item_ids fica vazio.
    await user.click(await screen.findByRole("button", { name: "Recusar Troca de óleo" }));
    await user.click(screen.getByRole("button", { name: "Registrar decisão" }));

    await waitFor(() =>
      expect(quotesApi.approveQuotePhysical).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ approved_item_ids: [] }),
      ),
    );
  });

  it("only offers PDF for a terminal (approved) quote", async () => {
    vi.mocked(quotesApi.listQuotes).mockResolvedValue([
      quote({ status: "approved", status_display: "Aprovado", client_name: "André", channel_display: "Link por e-mail" }),
    ]);
    renderPanel();
    expect(await screen.findByRole("button", { name: "Gerar PDF" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aprovar presencial" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Recusar" })).not.toBeInTheDocument();
  });
});
