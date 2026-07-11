import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FilterChips } from "@/components/shared/FilterChips";
import { MobileFilterSheet } from "@/components/shared/MobileFilterSheet";

describe("MobileFilterSheet", () => {
  it("shows the active count and opens the sheet with the filter controls", async () => {
    const user = userEvent.setup();
    render(
      <MobileFilterSheet activeCount={2} onClear={vi.fn()}>
        <div>CONTROLES</div>
      </MobileFilterSheet>,
    );
    const trigger = screen.getByRole("button", { name: /filtros/i });
    expect(trigger).toHaveTextContent("2");
    expect(screen.queryByText("CONTROLES")).not.toBeInTheDocument();
    await user.click(trigger);
    expect(await screen.findByText("CONTROLES")).toBeInTheDocument();
  });

  it("calls onClear from the Limpar filtros button", async () => {
    const onClear = vi.fn();
    const user = userEvent.setup();
    render(
      <MobileFilterSheet activeCount={1} onClear={onClear}>
        <div>x</div>
      </MobileFilterSheet>,
    );
    await user.click(screen.getByRole("button", { name: /filtros/i }));
    await user.click(await screen.findByRole("button", { name: "Limpar filtros" }));
    expect(onClear).toHaveBeenCalled();
  });
});

describe("FilterChips", () => {
  it("renders nothing when there are no active filters", () => {
    const { container } = render(<FilterChips chips={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders chips and removes one on click", async () => {
    const onRemove = vi.fn();
    const onClearAll = vi.fn();
    const user = userEvent.setup();
    render(
      <FilterChips
        chips={[{ label: "Status: Em execução", onRemove }]}
        onClearAll={onClearAll}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Remover filtro Status: Em execução" }));
    expect(onRemove).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Limpar" }));
    expect(onClearAll).toHaveBeenCalled();
  });
});
