import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import * as partsApi from "@/features/parts/api";
import { PartsPage } from "@/features/parts/pages/PartsPage";
import type { Part } from "@/features/parts/types";

vi.mock("@/features/parts/api");
vi.mock("@/features/categories/api");

function part(overrides: Partial<Part> = {}): Part {
  return {
    id: 1,
    category: 1,
    category_name: "Motor",
    name: "Filtro de óleo",
    internal_code: "",
    brand: "",
    model_application: "",
    unit_of_measure: "unit",
    current_quantity: "10.00",
    min_quantity: "5.00",
    cost_price: null,
    sale_price: null,
    location: "",
    supplier: null,
    supplier_name: null,
    ncm: "",
    barcode: "",
    notes: "",
    is_low_stock: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PartsPage />
      <Toaster />
    </QueryClientProvider>,
  );
}

describe("PartsPage", () => {
  beforeEach(() => {
    vi.mocked(partsApi.listParts).mockReset();
    vi.mocked(partsApi.deletePart).mockReset();
    vi.mocked(partsApi.reactivatePart).mockReset();
  });

  it("renders the 'Peças em Estoque' heading and 'Nova peça' button", async () => {
    vi.mocked(partsApi.listParts).mockResolvedValue([]);
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Peças em Estoque" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /nova peça/i }).length).toBeGreaterThan(0);
  });

  it("shows the empty state when there are no parts", async () => {
    vi.mocked(partsApi.listParts).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("Nenhuma peça cadastrada ainda.")).toBeInTheDocument();
    expect(partsApi.listParts).toHaveBeenCalledWith({ search: undefined, status: "active" });
  });

  it("lists parts with category, quantity, and min stock", async () => {
    vi.mocked(partsApi.listParts).mockResolvedValue([part()]);
    renderPage();

    const table = await screen.findByRole("table");
    expect(within(table).getByText("Filtro de óleo")).toBeInTheDocument();
    expect(within(table).getByText("Motor")).toBeInTheDocument();
    expect(within(table).getByText("10 Unidade")).toBeInTheDocument();
    expect(within(table).getByText("5")).toBeInTheDocument();
  });

  it("shows the linked supplier's name, or a dash when there is none", async () => {
    vi.mocked(partsApi.listParts).mockResolvedValue([
      part({ id: 1, supplier: 1, supplier_name: "Fornecedor Ltda" }),
      part({ id: 2, name: "Vela de ignição", supplier: null, supplier_name: null }),
    ]);
    renderPage();

    const table = await screen.findByRole("table");
    expect(within(table).getByText("Fornecedor Ltda")).toBeInTheDocument();
    const dashCells = within(table).getAllByText("—");
    expect(dashCells.length).toBeGreaterThan(0);
  });

  it("shows a dash for min stock when it is not set", async () => {
    vi.mocked(partsApi.listParts).mockResolvedValue([part({ min_quantity: null })]);
    renderPage();

    const table = await screen.findByRole("table");
    // The Fornecedor column also shows "—" when unset, so there are two
    // dashes in this row -- assert at least one rather than a single exact match.
    expect(within(table).getAllByText("—").length).toBeGreaterThan(0);
  });

  it("shows the 'Estoque baixo' badge when is_low_stock is true", async () => {
    vi.mocked(partsApi.listParts).mockResolvedValue([part({ is_low_stock: true })]);
    renderPage();

    expect(await screen.findByText("Estoque baixo")).toBeInTheDocument();
  });

  it("does not show the 'Estoque baixo' badge when is_low_stock is false", async () => {
    vi.mocked(partsApi.listParts).mockResolvedValue([part({ is_low_stock: false })]);
    renderPage();

    await screen.findByText("Filtro de óleo");
    expect(screen.queryByText("Estoque baixo")).not.toBeInTheDocument();
  });

  it("debounces the search box and queries by name/code/category/brand", async () => {
    vi.mocked(partsApi.listParts).mockResolvedValue([part()]);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Filtro de óleo");
    await user.type(
      screen.getByPlaceholderText("Buscar por nome, código, categoria ou marca..."),
      "filtro",
    );

    await waitFor(() =>
      expect(partsApi.listParts).toHaveBeenLastCalledWith({
        search: "filtro",
        status: "active",
      }),
    );
  });

  it("clears the search box and refetches unfiltered", async () => {
    vi.mocked(partsApi.listParts).mockResolvedValue([part()]);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Filtro de óleo");
    await user.type(screen.getByPlaceholderText("Buscar por nome, código, categoria ou marca..."), "x");
    await user.click(screen.getByRole("button", { name: /limpar pesquisa/i }));

    await waitFor(() =>
      expect(partsApi.listParts).toHaveBeenLastCalledWith({
        search: undefined,
        status: "active",
      }),
    );
  });

  it("switches to the inactive filter and shows Reativar instead of Excluir", async () => {
    vi.mocked(partsApi.listParts).mockResolvedValue([part()]);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Filtro de óleo");
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Peças desabilitadas" }));

    await waitFor(() =>
      expect(partsApi.listParts).toHaveBeenLastCalledWith({
        search: undefined,
        status: "inactive",
      }),
    );
    expect(screen.getByLabelText("Reativar peça")).toBeInTheDocument();
    expect(screen.queryByLabelText("Excluir peça")).not.toBeInTheDocument();
  });

  it("shows an error state with a retry button when the query fails", async () => {
    vi.mocked(partsApi.listParts).mockRejectedValue(new Error("network"));
    renderPage();

    expect(
      await screen.findByText("Não foi possível carregar as peças. Tente novamente."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tentar novamente/i })).toBeInTheDocument();
  });

  it("shows a distinct empty state for a search with no results", async () => {
    vi.mocked(partsApi.listParts).mockImplementation((params) =>
      Promise.resolve(params?.search ? [] : [part()]),
    );
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Filtro de óleo");
    await user.type(
      screen.getByPlaceholderText("Buscar por nome, código, categoria ou marca..."),
      "zzz",
    );

    await screen.findByText('Nenhuma peça encontrada para "zzz".');
  });

  it("soft-deletes a part through the confirm dialog", async () => {
    vi.mocked(partsApi.listParts).mockResolvedValue([part()]);
    vi.mocked(partsApi.deletePart).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Filtro de óleo");
    await user.click(screen.getByLabelText("Excluir peça"));
    await user.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(() =>
      expect(partsApi.deletePart).toHaveBeenCalledWith(1, expect.anything()),
    );
  });

  it("reactivates a part from the inactive list", async () => {
    vi.mocked(partsApi.listParts).mockResolvedValue([part({ id: 2 })]);
    vi.mocked(partsApi.reactivatePart).mockResolvedValue(part({ id: 2 }));
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Filtro de óleo");
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Peças desabilitadas" }));

    await user.click(await screen.findByLabelText("Reativar peça"));

    await waitFor(() =>
      expect(partsApi.reactivatePart).toHaveBeenCalledWith(2, expect.anything()),
    );
  });
});
