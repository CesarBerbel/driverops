import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as ordersApi from "@/features/orders/api";
import { OrderStatusStepper } from "@/features/orders/components/OrderStatusStepper";
import type { OrderStatus, OrderStatusHistoryEntry } from "@/features/orders/types";

vi.mock("@/features/orders/api");

function historyEntry(to_status: string, created_at: string): OrderStatusHistoryEntry {
  return {
    id: Math.floor(Math.random() * 1e6),
    from_status: "",
    from_status_display: "",
    to_status,
    to_status_display: to_status,
    action: "",
    changed_by_name: "Admin",
    reason: "",
    note: "",
    source: "manual",
    source_display: "Manual",
    created_at,
  };
}

function renderStepper(status: OrderStatus, orderId?: number) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <OrderStatusStepper status={status} orderId={orderId ?? null} />
    </QueryClientProvider>,
  );
}

describe("OrderStatusStepper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ordersApi.listStatusHistory).mockResolvedValue([]);
  });

  it("labels the current status and exposes the timeline", async () => {
    renderStepper("in_progress");
    const timeline = await screen.findByRole("list", {
      name: /Linha do tempo de status da OS/,
    });
    expect(timeline).toHaveAccessibleName(/atual: Em execução/);
    // Every flow step is present as a labelled step (9 steps in the happy path).
    expect(screen.getByText("Aberta")).toBeInTheDocument();
    expect(screen.getByText("Em execução")).toBeInTheDocument();
    expect(screen.getByText("Finalizada")).toBeInTheDocument();
  });

  it("shows the date each reached status was entered", async () => {
    vi.mocked(ordersApi.listStatusHistory).mockResolvedValue([
      historyEntry("diagnosing", "2026-07-05T10:00:00Z"),
      historyEntry("open", "2026-07-04T09:00:00Z"),
    ]);
    renderStepper("diagnosing", 1);
    // "Aberta" foi alcançada em 04/07/26; "Em diagnóstico" em 05/07/26.
    expect(await screen.findByText("04/07/26")).toBeInTheDocument();
    expect(screen.getByText("05/07/26")).toBeInTheDocument();
  });

  it("shows a distinct terminal state when canceled", () => {
    renderStepper("canceled");
    expect(screen.getByLabelText("Ordem de serviço cancelada")).toBeInTheDocument();
    expect(screen.getByText("OS cancelada")).toBeInTheDocument();
  });
});
