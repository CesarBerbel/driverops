import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import * as categoriesApi from "@/features/categories/api";
import type { Category } from "@/features/categories/types";
import * as partsApi from "@/features/parts/api";
import type { Part } from "@/features/parts/types";
import * as servicesApi from "@/features/services/api";
import { ServiceFormSheet } from "@/features/services/ServiceFormSheet";
import type { Service } from "@/features/services/types";

vi.mock("@/features/services/api");
vi.mock("@/features/categories/api");
vi.mock("@/features/parts/api");
vi.mock("@/features/suppliers/api");

function category(overrides: Partial<Category> = {}): Category {
  return {
    id: 1,
    category_type: "service",
    name: "Mecânica",
    description: "",
    notes: "",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function part(overrides: Partial<Part> = {}): Part {
  return {
    id: 1,
    category: 5,
    category_name: "Filtros",
    name: "Filtro de óleo",
    internal_code: "",
    brand: "",
    model_application: "",
    unit_of_measure: "unit",
    current_quantity: "10.00",
    min_quantity: null,
    cost_price: null,
    sale_price: "50.00",
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

function service(overrides: Partial<Service> = {}): Service {
  return {
    id: 1,
    name: "Troca de óleo",
    category: 1,
    category_name: "Mecânica",
    description: "",
    labor_cost: "100.00",
    estimated_minutes: null,
    notes: "",
    standard_parts: [],
    value: "100.00",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderSheet(onOpenChange = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ServiceFormSheet open serviceId={null} onOpenChange={onOpenChange} />
      <Toaster />
    </QueryClientProvider>,
  );
  return { onOpenChange };
}

describe("ServiceFormSheet", () => {
  beforeEach(() => {
    vi.mocked(servicesApi.createService).mockReset();
    vi.mocked(categoriesApi.listCategories).mockReset();
    vi.mocked(categoriesApi.createCategory).mockReset();
    vi.mocked(partsApi.listParts).mockReset();
    vi.mocked(partsApi.createPart).mockReset();
    vi.mocked(categoriesApi.listCategories).mockImplementation((type) =>
      Promise.resolve(type === "service" ? [category()] : [category({ id: 5, category_type: "part", name: "Filtros" })]),
    );
    vi.mocked(partsApi.listParts).mockResolvedValue([]);
  });

  it("requires a name and a category before submitting", async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("O nome do serviço é obrigatório.")).toBeInTheDocument();
    expect(screen.getByText("Selecione uma categoria.")).toBeInTheDocument();
    expect(servicesApi.createService).not.toHaveBeenCalled();
  });

  it("submits with name, category, and default labor cost", async () => {
    vi.mocked(servicesApi.createService).mockResolvedValue(service());
    const user = userEvent.setup();
    const { onOpenChange } = renderSheet();

    await user.type(screen.getByLabelText("Nome do serviço"), "Troca de óleo");
    await user.click(screen.getByLabelText("Categoria do serviço"));
    await user.click(await screen.findByRole("option", { name: "Mecânica" }));
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(servicesApi.createService).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Troca de óleo", category: 1, labor_cost: "0" }),
      ),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("'Salvar e adicionar outro' saves, keeps the sheet open, and clears the form", async () => {
    vi.mocked(servicesApi.createService).mockResolvedValue(service());
    const user = userEvent.setup();
    const { onOpenChange } = renderSheet();

    await user.type(screen.getByLabelText("Nome do serviço"), "Troca de óleo");
    await user.click(screen.getByLabelText("Categoria do serviço"));
    await user.click(await screen.findByRole("option", { name: "Mecânica" }));
    await user.click(screen.getByRole("button", { name: "Salvar e adicionar outro" }));

    await waitFor(() => expect(servicesApi.createService).toHaveBeenCalled());
    // Sheet stays open (not closed) and the form is reset for the next record.
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    await waitFor(() =>
      expect(screen.getByLabelText("Nome do serviço")).toHaveValue(""),
    );
  });

  it("adds a standard part via autocomplete and submits it, then can remove it", async () => {
    vi.mocked(partsApi.listParts).mockResolvedValue([part()]);
    vi.mocked(servicesApi.createService).mockResolvedValue(service());
    const user = userEvent.setup();
    renderSheet();

    await user.type(screen.getByLabelText("Nome do serviço"), "Troca de óleo");
    await user.click(screen.getByLabelText("Categoria do serviço"));
    await user.click(await screen.findByRole("option", { name: "Mecânica" }));

    await user.click(screen.getByPlaceholderText("Buscar peça pelo nome ou código..."));
    await user.click(await screen.findByRole("button", { name: /Filtro de óleo/ }));

    // Row added.
    expect(screen.getByText("Filtro de óleo")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(servicesApi.createService).toHaveBeenCalledWith(
        expect.objectContaining({
          standard_parts: [
            { part: 1, suggested_quantity: "1", is_required: true, notes: "" },
          ],
        }),
      ),
    );
  });

  it("creates a category inline and auto-selects it without losing other field values", async () => {
    vi.mocked(categoriesApi.createCategory).mockResolvedValue(
      category({ id: 9, name: "Elétrica" }),
    );
    vi.mocked(servicesApi.createService).mockResolvedValue(service());
    const user = userEvent.setup();
    renderSheet();

    await user.type(screen.getByLabelText("Nome do serviço"), "Reparo elétrico");
    await user.click(screen.getByRole("button", { name: /adicionar categoria/i }));
    expect(await screen.findByRole("dialog", { name: "Nova categoria" })).toBeInTheDocument();

    vi.mocked(categoriesApi.listCategories).mockImplementation((type) =>
      Promise.resolve(type === "service" ? [category({ id: 9, name: "Elétrica" })] : []),
    );

    await user.type(
      within(screen.getByRole("dialog", { name: "Nova categoria" })).getByLabelText("Nome"),
      "Elétrica",
    );
    await user.click(
      within(screen.getByRole("dialog", { name: "Nova categoria" })).getByRole("button", {
        name: "Salvar",
      }),
    );

    await waitFor(() =>
      expect(categoriesApi.createCategory).toHaveBeenCalledWith(
        expect.objectContaining({ category_type: "service", name: "Elétrica" }),
      ),
    );
    expect(screen.queryByRole("dialog", { name: "Nova categoria" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nome do serviço")).toHaveValue("Reparo elétrico");
    // Submitting the inline category form must not also submit the service form.
    expect(servicesApi.createService).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(servicesApi.createService).toHaveBeenCalledWith(
        expect.objectContaining({ category: 9, name: "Reparo elétrico" }),
      ),
    );
  });

  it("creates a part inline and auto-adds it to standard parts without losing service data", async () => {
    vi.mocked(partsApi.createPart).mockResolvedValue(part({ id: 7, name: "Vela nova" }));
    vi.mocked(servicesApi.createService).mockResolvedValue(service());
    const user = userEvent.setup();
    renderSheet();

    await user.type(screen.getByLabelText("Nome do serviço"), "Troca de velas");
    await user.click(screen.getByLabelText("Categoria do serviço"));
    await user.click(await screen.findByRole("option", { name: "Mecânica" }));

    await user.click(screen.getByRole("button", { name: /adicionar peça/i }));
    const dialog = await screen.findByRole("dialog", { name: "Nova peça" });
    await user.type(within(dialog).getByLabelText("Nome da peça"), "Vela nova");
    await user.click(within(dialog).getByLabelText("Categoria da peça"));
    await user.click(await screen.findByRole("option", { name: "Filtros" }));
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(partsApi.createPart).toHaveBeenCalled());
    expect(screen.queryByRole("dialog", { name: "Nova peça" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nome do serviço")).toHaveValue("Troca de velas");
    // The new part is in the standard-parts list.
    expect(screen.getByText("Vela nova")).toBeInTheDocument();
    // The inline part-save must not have submitted the service form.
    expect(servicesApi.createService).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(servicesApi.createService).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Troca de velas",
          standard_parts: [
            { part: 7, suggested_quantity: "1", is_required: true, notes: "" },
          ],
        }),
      ),
    );
  });
});
