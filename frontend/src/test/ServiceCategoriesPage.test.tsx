import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as categoriesApi from "@/features/categories/api";
import { ServiceCategoriesPage } from "@/features/categories/pages/ServiceCategoriesPage";
import type { Category } from "@/features/categories/types";

vi.mock("@/features/categories/api");

function activeServiceCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 1,
    category_type: "service",
    name: "Revisão",
    description: "",
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
      <MemoryRouter initialEntries={["/settings/categories/services"]}>
        <Routes>
          <Route path="/settings" element={<div>Settings page</div>} />
          <Route path="/settings/categories/services" element={<ServiceCategoriesPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ServiceCategoriesPage", () => {
  beforeEach(() => {
    vi.mocked(categoriesApi.listCategories).mockReset();
    vi.mocked(categoriesApi.createCategory).mockReset();
  });

  it("renders the 'Categorias de Serviços' heading", async () => {
    vi.mocked(categoriesApi.listCategories).mockResolvedValue([]);
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Categorias de Serviços" }),
    ).toBeInTheDocument();
  });

  it("lists categories scoped to the 'service' category type", async () => {
    vi.mocked(categoriesApi.listCategories).mockResolvedValue([activeServiceCategory()]);
    renderPage();

    await screen.findByText("Revisão");
    expect(categoriesApi.listCategories).toHaveBeenCalledWith("service", "active");
  });

  it("creates a category scoped to the 'service' category type", async () => {
    vi.mocked(categoriesApi.listCategories).mockResolvedValue([]);
    vi.mocked(categoriesApi.createCategory).mockResolvedValue(
      activeServiceCategory({ name: "Alinhamento" }),
    );
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Nenhuma categoria cadastrada ainda.");
    const [createButton] = screen.getAllByRole("button", { name: /nova categoria/i });
    await user.click(createButton);

    await user.type(screen.getByLabelText("Nome"), "Alinhamento");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(categoriesApi.createCategory).toHaveBeenCalledWith(
        expect.objectContaining({ category_type: "service", name: "Alinhamento" }),
      ),
    );
  });
});
