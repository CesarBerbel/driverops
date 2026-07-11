import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Pagination } from "@/components/shared/Pagination";

describe("Pagination", () => {
  it("does not render when everything fits in one page", () => {
    const { container } = render(
      <Pagination page={1} pageSize={20} count={12} onPageChange={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the visible range and total, and disables Anterior on page 1", () => {
    render(<Pagination page={1} pageSize={20} count={45} onPageChange={vi.fn()} />);
    expect(screen.getByText("1–20 de 45")).toBeInTheDocument();
    expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /página anterior/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /próxima página/i })).toBeEnabled();
  });

  it("disables Próxima on the last page", () => {
    render(<Pagination page={3} pageSize={20} count={45} onPageChange={vi.fn()} />);
    expect(screen.getByText("41–45 de 45")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /próxima página/i })).toBeDisabled();
  });

  it("calls onPageChange with the next/previous page", async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(<Pagination page={2} pageSize={20} count={45} onPageChange={onPageChange} />);
    await user.click(screen.getByRole("button", { name: /próxima página/i }));
    expect(onPageChange).toHaveBeenCalledWith(3);
    await user.click(screen.getByRole("button", { name: /página anterior/i }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });
});
