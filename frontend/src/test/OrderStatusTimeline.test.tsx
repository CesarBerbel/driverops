import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as ordersApi from "@/features/orders/api";
import { OrderStatusTimeline } from "@/features/orders/components/OrderStatusTimeline";
import type { OrderStatusHistoryEntry } from "@/features/orders/types";

vi.mock("@/features/orders/api");

function entry(overrides: Partial<OrderStatusHistoryEntry> = {}): OrderStatusHistoryEntry {
  return {
    id: 1,
    from_status: "open",
    from_status_display: "Aberta",
    to_status: "diagnosing",
    to_status_display: "Em diagnóstico",
    action: "start_diagnosis",
    changed_by_name: "Admin",
    reason: "",
    note: "",
    source: "manual",
    source_display: "Manual",
    created_at: "2026-07-05T12:00:00Z",
    ...overrides,
  };
}

function renderTimeline() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <OrderStatusTimeline orderId={1} />
    </QueryClientProvider>,
  );
}

describe("OrderStatusTimeline", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the timeline entries with the transition", async () => {
    vi.mocked(ordersApi.listStatusHistory).mockResolvedValue([
      entry({ id: 2, from_status: "diagnosing", from_status_display: "Em diagnóstico", to_status_display: "Aguardando aprovação" }),
      entry({ id: 1, from_status: "", from_status_display: "", to_status: "open", to_status_display: "Aberta" }),
    ]);
    renderTimeline();
    expect(await screen.findByText(/Aguardando aprovação/)).toBeInTheDocument();
    // Entrada de criação (from vazio) é rotulada "OS criada".
    expect(screen.getByText(/OS criada/)).toBeInTheDocument();
  });

  it("shows an empty state when there is no history", async () => {
    vi.mocked(ordersApi.listStatusHistory).mockResolvedValue([]);
    renderTimeline();
    expect(
      await screen.findByText(/Nenhuma mudança de status registrada/),
    ).toBeInTheDocument();
  });
});
