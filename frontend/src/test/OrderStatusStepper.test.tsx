import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OrderStatusStepper } from "@/features/orders/components/OrderStatusStepper";

describe("OrderStatusStepper", () => {
  it("labels the current status and exposes the timeline", () => {
    render(<OrderStatusStepper status="in_progress" />);
    const timeline = screen.getByRole("list", {
      name: /Linha do tempo de status da OS/,
    });
    expect(timeline).toHaveAccessibleName(/atual: Em execução/);
    // The current step shows its label inline.
    expect(screen.getByText("Em execução")).toBeInTheDocument();
    // Every flow step is present as a titled dot (9 steps in the happy path).
    expect(screen.getByTitle("Aberta")).toBeInTheDocument();
    expect(screen.getByTitle("Finalizada")).toBeInTheDocument();
  });

  it("shows a distinct terminal state when canceled", () => {
    render(<OrderStatusStepper status="canceled" />);
    expect(screen.getByLabelText("Ordem de serviço cancelada")).toBeInTheDocument();
    expect(screen.getByText("OS cancelada")).toBeInTheDocument();
  });
});
