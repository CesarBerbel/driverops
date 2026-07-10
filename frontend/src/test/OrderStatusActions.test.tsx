import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import { OrderStatusActions } from "@/features/orders/components/OrderStatusActions";
import type { OrderTransition, WorkOrder } from "@/features/orders/types";

vi.mock("@/features/orders/api", () => ({
  getOrderTransitions: vi.fn(),
  transitionOrder: vi.fn(),
}));
import * as api from "@/features/orders/api";

function transition(over: Partial<OrderTransition> = {}): OrderTransition {
  return {
    action: "start_diagnosis",
    label: "Iniciar diagnóstico",
    target_status: "diagnosing",
    target_status_display: "Em diagnóstico",
    permission: "kanban.move",
    reason_required: false,
    critical: false,
    available: true,
    block_reason: "",
    ...over,
  };
}

function renderActions() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <OrderStatusActions orderId={1} />
      <Toaster />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(api.transitionOrder).mockResolvedValue({
    status: "diagnosing",
    status_display: "Em diagnóstico",
  } as WorkOrder);
});

describe("OrderStatusActions", () => {
  it("renders only the actions the backend returned", async () => {
    vi.mocked(api.getOrderTransitions).mockResolvedValue({
      status: "open",
      status_display: "Aberta",
      transitions: [
        transition(),
        transition({ action: "send_to_approval", label: "Enviar para aprovação" }),
      ],
    });
    renderActions();
    expect(await screen.findByRole("button", { name: "Iniciar diagnóstico" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar para aprovação" })).toBeInTheDocument();
  });

  it("executes a simple action directly", async () => {
    vi.mocked(api.getOrderTransitions).mockResolvedValue({
      status: "open",
      status_display: "Aberta",
      transitions: [transition()],
    });
    renderActions();
    await userEvent.click(await screen.findByRole("button", { name: "Iniciar diagnóstico" }));
    await waitFor(() =>
      expect(api.transitionOrder).toHaveBeenCalledWith(1, { action: "start_diagnosis" }),
    );
  });

  it("disables a blocked action and shows the impediment reason", async () => {
    vi.mocked(api.getOrderTransitions).mockResolvedValue({
      status: "approved",
      status_display: "Aprovada",
      transitions: [
        transition({
          action: "start_execution",
          label: "Iniciar execução",
          target_status: "in_progress",
          available: false,
          block_reason: "Não é possível iniciar a execução sem um orçamento aprovado.",
        }),
      ],
    });
    renderActions();
    const button = await screen.findByRole("button", { name: "Iniciar execução" });
    expect(button).toBeDisabled();
    expect(
      screen.getByText("Não é possível iniciar a execução sem um orçamento aprovado."),
    ).toBeInTheDocument();
  });

  it("requires a justification for critical actions", async () => {
    vi.mocked(api.getOrderTransitions).mockResolvedValue({
      status: "diagnosing",
      status_display: "Em diagnóstico",
      transitions: [
        transition({
          action: "cancel",
          label: "Cancelar",
          target_status: "canceled",
          reason_required: true,
          critical: true,
        }),
      ],
    });
    renderActions();
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    // Diálogo abre; confirmar fica desabilitado sem justificativa.
    const confirm = await screen.findByRole("button", { name: "Confirmar" });
    expect(confirm).toBeDisabled();
    await userEvent.type(
      screen.getByLabelText(/Justificativa/),
      "Cliente desistiu do serviço.",
    );
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    await waitFor(() =>
      expect(api.transitionOrder).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          action: "cancel",
          reason: "Cliente desistiu do serviço.",
        }),
      ),
    );
  });
});
