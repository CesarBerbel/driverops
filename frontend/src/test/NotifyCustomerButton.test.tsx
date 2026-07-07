import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import * as ordersApi from "@/features/orders/api";
import { NotifyCustomerButton } from "@/features/orders/components/NotifyCustomerButton";

vi.mock("@/features/orders/api");

function renderButton() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <NotifyCustomerButton orderId={7} />
      <Toaster />
    </QueryClientProvider>,
  );
}

describe("NotifyCustomerButton", () => {
  beforeEach(() => vi.clearAllMocks());

  it("notifies the customer and shows the destination e-mail", async () => {
    vi.mocked(ordersApi.notifyCustomer).mockResolvedValue({
      sent: true,
      email: "cliente@example.com",
    });
    const user = userEvent.setup();
    renderButton();
    await user.click(screen.getByRole("button", { name: /Notificar cliente/ }));
    await waitFor(() => expect(ordersApi.notifyCustomer).toHaveBeenCalledWith(7));
    expect(
      await screen.findByText(/E-mail enviado ao cliente \(cliente@example.com\)/),
    ).toBeInTheDocument();
  });
});
