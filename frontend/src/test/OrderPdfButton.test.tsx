import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as ordersApi from "@/features/orders/api";
import { OrderPdfButton } from "@/features/orders/components/OrderPdfButton";

vi.mock("@/features/orders/api");

function renderButton() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <OrderPdfButton orderId={7} />
    </QueryClientProvider>,
  );
}

describe("OrderPdfButton", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens the OS PDF", async () => {
    vi.mocked(ordersApi.openOrderPdf).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderButton();
    await user.click(screen.getByRole("button", { name: /PDF/ }));
    await waitFor(() => expect(ordersApi.openOrderPdf).toHaveBeenCalledWith(7));
  });
});
