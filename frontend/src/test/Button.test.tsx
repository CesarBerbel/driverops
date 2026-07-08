import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

describe("Button", () => {
  // Regressão: botões de ação dentro de um <form> (ex.: gerar PDF/copiar link no
  // painel de orçamento da OS) não podem herdar type="submit" e navegar para fora.
  it('defaults to type="button"', () => {
    render(<Button>Ação</Button>);
    expect(screen.getByRole("button", { name: "Ação" })).toHaveAttribute("type", "button");
  });

  it('respects an explicit type="submit"', () => {
    render(<Button type="submit">Salvar</Button>);
    expect(screen.getByRole("button", { name: "Salvar" })).toHaveAttribute("type", "submit");
  });

  it("does not submit its enclosing form when clicked", async () => {
    let submitted = false;
    render(
      <form onSubmit={() => (submitted = true)}>
        <Button>Gerar PDF</Button>
      </form>,
    );
    screen.getByRole("button", { name: "Gerar PDF" }).click();
    expect(submitted).toBe(false);
  });
});
