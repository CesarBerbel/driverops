import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SearchSuggestionChips } from "@/features/smart-search/components/SearchSuggestionChips";
import type { SavedSearch } from "@/features/smart-search/types";

function saved(over: Partial<SavedSearch> = {}): SavedSearch {
  return { id: 1, label: "OS atrasadas", query: "OS atrasadas", filters: {}, created_at: "2026-07-01", ...over };
}

describe("SearchSuggestionChips", () => {
  it("renders saved, recent and starter sections and wires the callbacks", async () => {
    const onPick = vi.fn();
    const onDeleteSaved = vi.fn();
    const user = userEvent.setup();

    render(
      <SearchSuggestionChips
        starters={["OS aguardando aprovação"]}
        recent={["Honda Civic"]}
        saved={[saved(), saved({ id: 2, label: "Clientes inativos", query: "clientes inativos" })]}
        onPick={onPick}
        onDeleteSaved={onDeleteSaved}
      />,
    );

    expect(screen.getByText("Pesquisas salvas")).toBeInTheDocument();
    expect(screen.getByText("Buscas recentes")).toBeInTheDocument();
    expect(screen.getByText("Sugestões")).toBeInTheDocument();

    await user.click(screen.getByText("OS atrasadas"));
    expect(onPick).toHaveBeenCalledWith("OS atrasadas");

    await user.click(screen.getByText("Honda Civic"));
    expect(onPick).toHaveBeenCalledWith("Honda Civic");

    await user.click(screen.getByText("OS aguardando aprovação"));
    expect(onPick).toHaveBeenCalledWith("OS aguardando aprovação");

    await user.click(screen.getByRole("button", { name: /remover pesquisa salva os atrasadas/i }));
    expect(onDeleteSaved).toHaveBeenCalledWith(1);
  });

  it("omits the saved/recent sections when empty", () => {
    render(
      <SearchSuggestionChips
        starters={["Carros com problema no freio"]}
        recent={[]}
        saved={[]}
        onPick={vi.fn()}
        onDeleteSaved={vi.fn()}
      />,
    );
    expect(screen.queryByText("Pesquisas salvas")).not.toBeInTheDocument();
    expect(screen.queryByText("Buscas recentes")).not.toBeInTheDocument();
    expect(screen.getByText("Sugestões")).toBeInTheDocument();
  });
});
