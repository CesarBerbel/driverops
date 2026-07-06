import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as ordersApi from "@/features/orders/api";
import { OrderEventTimeline } from "@/features/orders/components/OrderEventTimeline";
import type { OrderEvent } from "@/features/orders/types";

vi.mock("@/features/orders/api");

function event(overrides: Partial<OrderEvent> = {}): OrderEvent {
  return {
    id: 1,
    event_type: "status_changed",
    event_type_display: "Status alterado",
    description: "Aberta → Em diagnóstico",
    actor_name: "Admin",
    channel: "",
    created_at: "2026-07-05T12:00:00Z",
    ...overrides,
  };
}

function renderTimeline() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <OrderEventTimeline orderId={1} />
    </QueryClientProvider>,
  );
}

describe("OrderEventTimeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ordersApi.listOrderEvents).mockResolvedValue([
      event(),
      event({ id: 2, event_type: "quote_sent", event_type_display: "Orçamento enviado", channel: "Link por e-mail" }),
    ]);
  });

  it("renders the unified timeline with events", async () => {
    renderTimeline();
    expect(await screen.findByText(/Status alterado/)).toBeInTheDocument();
    expect(screen.getAllByText(/Aberta → Em diagnóstico/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Orçamento enviado/)).toBeInTheDocument();
  });

  it("filters events by type", async () => {
    const user = userEvent.setup();
    renderTimeline();
    await screen.findByText("Status alterado");

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Orçamento enviado" }));

    await waitFor(() =>
      expect(ordersApi.listOrderEvents).toHaveBeenLastCalledWith(1, "quote_sent"),
    );
  });
});
