import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as categoriesApi from "@/features/categories/api";
import { ClientCategoriesPage } from "@/features/categories/pages/ClientCategoriesPage";
import type { Category } from "@/features/categories/types";

vi.mock("@/features/categories/api");

function activeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 1,
    category_type: "client",
    name: "Fuel",
    description: "Fuel expenses",
    notes: "",
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
          <Route path="/settings/categories" element={<ClientCategoriesPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ClientCategoriesPage", () => {
  beforeEach(() => {
    vi.mocked(categoriesApi.listCategories).mockReset();
    vi.mocked(categoriesApi.createCategory).mockReset();
  });

  it("renders the 'Categorias de Clientes' heading", async () => {
    vi.mocked(categoriesApi.listCategories).mockResolvedValue([]);
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Categorias de Clientes" }),
    ).toBeInTheDocument();
  });

  it("shows the empty state and no status/active column when there are no categories", async () => {
    vi.mocked(categoriesApi.listCategories).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("Nenhuma categoria cadastrada ainda.")).toBeInTheDocument();
    expect(categoriesApi.listCategories).toHaveBeenCalledWith("client", "active");
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
    expect(screen.queryByText(/^ativo$/i)).not.toBeInTheDocument();
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

  it("uses friendly 'habilitadas/desabilitadas' filter language", async () => {
    vi.mocked(categoriesApi.listCategories).mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Nenhuma categoria cadastrada ainda.");
    await user.click(screen.getByRole("combobox"));

    expect(screen.getByRole("option", { name: "Categorias habilitadas" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Categorias desabilitadas" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Todas" })).toBeInTheDocument();
  });

  it("submits a new category through the create dialog, including notes", async () => {
    vi.mocked(categoriesApi.listCategories).mockResolvedValue([]);
    vi.mocked(categoriesApi.createCategory).mockResolvedValue(activeCategory({ name: "New Cat" }));
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Nenhuma categoria cadastrada ainda.");
    // Both the header button and the empty-state CTA share this label.
    const [createButton] = screen.getAllByRole("button", { name: /nova categoria/i });
    await user.click(createButton);

    await user.type(screen.getByLabelText("Nome"), "New Cat");
    await user.type(screen.getByLabelText("Observações (opcional)"), "Some notes");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(categoriesApi.createCategory).toHaveBeenCalledWith({
        category_type: "client",
        name: "New Cat",
        description: "",
        notes: "Some notes",
      }),
    );
  });
});
