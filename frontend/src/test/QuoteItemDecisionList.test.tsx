import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { QuoteItemDecisionList } from "@/features/quotes/components/QuoteItemDecisionList";
import type { QuoteItem } from "@/features/quotes/types";

function item(overrides: Partial<QuoteItem>): QuoteItem {
  return {
    id: 0,
    kind: "part",
    kind_display: "Peça",
    description: "",
    quantity: "1",
    unit_price: "50.00",
    subtotal: "50.00",
    is_custom: false,
    notes: "",
    status: "pending",
    status_display: "Pendente",
    linked_service: null,
    ...overrides,
  };
}

const SERVICE = item({ id: 1, kind: "service", description: "Troca de pastilhas", subtotal: "100.00" });
const LINKED_PART = item({ id: 2, description: "Pastilha", linked_service: 1 });
const FREE_PART = item({ id: 3, description: "Fluido de freio" });

function Harness() {
  const [ids, setIds] = useState<number[]>([1, 2, 3]);
  return (
    <>
      <QuoteItemDecisionList items={[SERVICE, LINKED_PART, FREE_PART]} approvedIds={ids} onChange={setIds} />
      <span data-testid="ids">{ids.join(",")}</span>
    </>
  );
}

describe("QuoteItemDecisionList linked items", () => {
  it("has no independent approve/reject buttons for a linked part", () => {
    render(<Harness />);
    // O serviço e a peça avulsa têm botões; a peça vinculada não.
    expect(screen.getByRole("button", { name: "Recusar Troca de pastilhas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recusar Fluido de freio" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Recusar Pastilha" })).not.toBeInTheDocument();
  });

  it("rejecting the service also removes its linked part from the approved set", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Recusar Troca de pastilhas" }));
    // Serviço (1) e peça vinculada (2) saem juntos; a peça avulsa (3) permanece.
    expect(screen.getByTestId("ids")).toHaveTextContent(/^3$/);
  });

  it("re-approving the service brings the linked part back", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Recusar Troca de pastilhas" }));
    await user.click(screen.getByRole("button", { name: "Aprovar Troca de pastilhas" }));
    const ids = screen
      .getByTestId("ids")
      .textContent!.split(",")
      .map(Number)
      .sort();
    expect(ids).toEqual([1, 2, 3]);
  });
});
