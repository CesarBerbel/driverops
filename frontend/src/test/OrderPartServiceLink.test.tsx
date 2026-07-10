import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { OrderLineList } from "@/features/orders/components/OrderLineList";
import type { OrderFormValues } from "@/features/orders/schemas";

// Vincular peça a serviço na OS exige orders.manage_part_links.
vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({ user: { is_superuser: true, permissions: [] } }),
}));

function Harness() {
  const { control, register, watch } = useForm<OrderFormValues>({
    defaultValues: {
      service_items: [],
      package_items: [],
      part_items: [
        {
          ref_id: null,
          name: "Óleo avulso",
          quantity: "1",
          unit_price: "R$ 40,00",
          linked_service_index: null,
        },
      ],
    },
  });
  const parts = watch("part_items");
  return (
    <>
      <OrderLineList
        title="Peças"
        namePrefix="part_items"
        picker={<div />}
        onAddCustom={() => {}}
        customLabel="Peça avulsa"
        emptyLabel="Nenhuma peça."
        control={control}
        register={register}
        fields={parts.map((p, i) => ({ ...p, id: String(i) }))}
        watchedItems={parts}
        remove={() => {}}
        serviceOptions={[{ index: 0, label: "Troca de óleo" }]}
      />
      <span data-testid="link">{String(parts[0]?.linked_service_index)}</span>
    </>
  );
}

describe("OrderLineList part→service link", () => {
  it("lets the user link an avulso part to a service", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // Começa sem vínculo.
    expect(screen.getByTestId("link")).toHaveTextContent("null");
    const select = screen.getByLabelText("Serviço vinculado");
    await user.click(select);
    await user.click(await screen.findByRole("option", { name: "Troca de óleo" }));

    // Passa a apontar para o serviço de índice 0.
    expect(screen.getByTestId("link")).toHaveTextContent("0");
  });
});
