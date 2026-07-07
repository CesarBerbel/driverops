import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as financialApi from "@/features/financial/api";
import { RegisterPaymentDialog } from "@/features/financial/components/RegisterPaymentDialog";
import type { Payment } from "@/features/financial/types";
import type { WorkOrder } from "@/features/orders/types";

vi.mock("@/features/financial/api");

const auth = vi.hoisted(() => ({
  user: { is_superuser: false, permissions: [] as string[] },
}));
vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({ user: auth.user }),
}));

function order(): WorkOrder {
  return {
    id: 7,
    number: 7,
    customer_name: "Maria Silva",
    vehicle_plate: "ABC1234",
    final_value: "160.00",
    amount_paid: "0.00",
    balance_due: "160.00",
    payment_status: "open",
  } as unknown as WorkOrder;
}

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 1,
    order: 7,
    amount: "100.00",
    method: "pix",
    method_display: "Pix",
    paid_at: "2026-07-06",
    note: "",
    created_by_name: "Admin",
    created_at: "2026-07-06T12:00:00Z",
    ...overrides,
  };
}

function renderDialog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RegisterPaymentDialog order={order()} open onOpenChange={() => {}} />
    </QueryClientProvider>,
  );
}

describe("RegisterPaymentDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user = { is_superuser: false, permissions: ["financial.view", "financial.register_payment"] };
    vi.mocked(financialApi.listPayments).mockResolvedValue([payment()]);
    vi.mocked(financialApi.createPayment).mockResolvedValue(payment({ id: 2 }));
  });

  it("computes paid/balance/status from the payments", async () => {
    renderDialog();
    // Pago 100 de 160 -> saldo 60, status Parcial.
    expect(await screen.findByText("R$ 100,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 60,00")).toBeInTheDocument();
    expect(screen.getByText("Parcial")).toBeInTheDocument();
  });

  it("registers a payment with the parsed amount", async () => {
    const user = userEvent.setup();
    renderDialog();
    await screen.findByText("R$ 100,00");
    // CurrencyInput trata dígitos como centavos: "6000" -> R$ 60,00.
    await user.type(screen.getByLabelText("Valor"), "6000");
    await user.click(screen.getByRole("button", { name: /Registrar pagamento/ }));
    await waitFor(() => expect(financialApi.createPayment).toHaveBeenCalledTimes(1));
    expect(financialApi.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({ order: 7, amount: "60", method: "pix" }),
    );
  });

  it("hides register/estorno for a view-only user", async () => {
    auth.user = { is_superuser: false, permissions: ["financial.view"] };
    renderDialog();
    await screen.findByText("R$ 100,00");
    expect(screen.queryByRole("button", { name: /Registrar pagamento/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Estornar pagamento/ })).toBeNull();
  });
});
