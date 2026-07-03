import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as categoriesApi from "@/features/categories/api";
import { CategoriesPage } from "@/features/categories/pages/CategoriesPage";
import type { Category } from "@/features/categories/types";

vi.mock("@/features/categories/api");

function activeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 1,
    name: "Fuel",
    description: "Fuel expenses",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/settings/categories"]}>
        <Routes>
          <Route path="/settings" element={<div>Settings page</div>} />
          <Route path="/settings/categories" element={<CategoriesPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CategoriesPage", () => {
  beforeEach(() => {
    vi.mocked(categoriesApi.listCategories).mockReset();
    vi.mocked(categoriesApi.createCategory).mockReset();
  });

  it("shows the empty state and no status/active column when there are no categories", async () => {
    vi.mocked(categoriesApi.listCategories).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("Nenhuma categoria cadastrada ainda.")).toBeInTheDocument();
    expect(categoriesApi.listCategories).toHaveBeenCalledWith("active");
  });

  it("renders the table with only Nome/Descrição/Ações columns -- no status field anywhere", async () => {
    vi.mocked(categoriesApi.listCategories).mockResolvedValue([activeCategory()]);
    renderPage();

    const table = await screen.findByRole("table");
    expect(within(table).getByText("Fuel")).toBeInTheDocument();

    const headers = within(table)
      .getAllByRole("columnheader")
      .map((header) => header.textContent);
    expect(headers).toEqual(["Nome", "Descrição", "Ações"]);

    expect(screen.queryByText(/status/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ativo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/habilitado/i)).not.toBeInTheDocument();
  });

  it("shows Excluir for active categories and Reativar for inactive ones", async () => {
    vi.mocked(categoriesApi.listCategories).mockResolvedValue([
      activeCategory({ id: 1, name: "Active One", is_active: true }),
    ]);
    renderPage();

    await screen.findByText("Active One");
    expect(screen.getByLabelText("Excluir categoria")).toBeInTheDocument();
    expect(screen.queryByLabelText("Reativar categoria")).not.toBeInTheDocument();
  });

  it("submits a new category through the create dialog", async () => {
    vi.mocked(categoriesApi.listCategories).mockResolvedValue([]);
    vi.mocked(categoriesApi.createCategory).mockResolvedValue(activeCategory({ name: "New Cat" }));
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Nenhuma categoria cadastrada ainda.");
    // Both the header button and the empty-state CTA share this label.
    const [createButton] = screen.getAllByRole("button", { name: /nova categoria/i });
    await user.click(createButton);

    await user.type(screen.getByLabelText("Nome"), "New Cat");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(categoriesApi.createCategory).toHaveBeenCalledWith({
        name: "New Cat",
        description: "",
      }),
    );
  });
});
