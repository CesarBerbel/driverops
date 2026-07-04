import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import * as categoriesApi from "@/features/categories/api";
import type { Category } from "@/features/categories/types";
import * as partsApi from "@/features/parts/api";
import { PartFormSheet } from "@/features/parts/PartFormSheet";
import type { Part } from "@/features/parts/types";
import * as suppliersApi from "@/features/suppliers/api";
import type { Supplier } from "@/features/suppliers/types";
import { formatCurrencyBRL } from "@/lib/masks";

vi.mock("@/features/parts/api");
vi.mock("@/features/categories/api");
vi.mock("@/features/suppliers/api");

function category(overrides: Partial<Category> = {}): Category {
  return {
    id: 1,
    category_type: "part",
    name: "Motor",
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

function supplier(overrides: Partial<Supplier> = {}): Supplier {
  return {
    id: 1,
    name: "Fornecedor Ltda",
    trade_name: "",
    supplier_type: "company",
    document: "",
    state_registration: "",
    email: "",
    phone: "",
    whatsapp: "",
    contact_name: "",
    zip_code: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    country: "Brasil",
    notes: "",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderSheet(onOpenChange = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <PartFormSheet open partId={null} onOpenChange={onOpenChange} />
      <Toaster />
    </QueryClientProvider>,
  );
  return { onOpenChange };
}

describe("PartFormSheet", () => {
  beforeEach(() => {
    vi.mocked(partsApi.createPart).mockReset();
    vi.mocked(partsApi.updatePart).mockReset();
    vi.mocked(partsApi.getPart).mockReset();
    vi.mocked(categoriesApi.listCategories).mockReset();
    vi.mocked(categoriesApi.createCategory).mockReset();
    vi.mocked(categoriesApi.listCategories).mockResolvedValue([category()]);
    vi.mocked(suppliersApi.createSupplier).mockReset();
    vi.mocked(suppliersApi.listSuppliers).mockReset();
    vi.mocked(suppliersApi.listSuppliers).mockResolvedValue([]);
  });

  it("requires a category and a name before submitting", async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Selecione uma categoria.")).toBeInTheDocument();
    expect(screen.getByText("O nome é obrigatório.")).toBeInTheDocument();
    expect(partsApi.createPart).not.toHaveBeenCalled();
  });

  it("submits with only category and name filled", async () => {
    vi.mocked(partsApi.createPart).mockResolvedValue(part());
    const user = userEvent.setup();
    const { onOpenChange } = renderSheet();

    await user.type(screen.getByLabelText("Nome da peça"), "Filtro de óleo");
    await user.click(screen.getByLabelText("Categoria da peça"));
    await user.click(await screen.findByRole("option", { name: "Motor" }));
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(partsApi.createPart).toHaveBeenCalledWith(
        expect.objectContaining({ category: 1, name: "Filtro de óleo", current_quantity: "0" }),
      ),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("pre-fills fields in edit mode", async () => {
    vi.mocked(partsApi.getPart).mockResolvedValue(
      part({ brand: "Bosch", cost_price: "120.50", current_quantity: "1000.50" }),
    );
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <PartFormSheet open partId={1} onOpenChange={vi.fn()} />
      </QueryClientProvider>,
    );

    expect(await screen.findByDisplayValue("Filtro de óleo")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Bosch")).toBeInTheDocument();
    expect(screen.getByLabelText("Preço de custo")).toHaveValue(formatCurrencyBRL(120.5));
    expect(screen.getByLabelText("Quantidade atual")).toHaveValue("1000,50");
  });

  it("formats currency input as the user types digits", async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.type(screen.getByLabelText("Preço de custo"), "12050");
    expect(screen.getByLabelText("Preço de custo")).toHaveValue(formatCurrencyBRL(120.5));
  });

  it("submits the current quantity as a parsed decimal", async () => {
    vi.mocked(partsApi.createPart).mockResolvedValue(part());
    const user = userEvent.setup();
    renderSheet();

    await user.type(screen.getByLabelText("Nome da peça"), "Filtro de óleo");
    await user.click(screen.getByLabelText("Categoria da peça"));
    await user.click(await screen.findByRole("option", { name: "Motor" }));

    const quantityInput = screen.getByLabelText("Quantidade atual");
    await user.clear(quantityInput);
    await user.type(quantityInput, "1000,5");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(partsApi.createPart).toHaveBeenCalledWith(
        expect.objectContaining({ current_quantity: "1000.5" }),
      ),
    );
  });

  it("formats the NCM field progressively as the user types", async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.type(screen.getByLabelText("NCM"), "87089990");
    expect(screen.getByLabelText("NCM")).toHaveValue("8708.99.90");
  });

  it("creates a category inline and auto-selects it without losing other field values", async () => {
    vi.mocked(categoriesApi.listCategories).mockResolvedValue([]);
    vi.mocked(categoriesApi.createCategory).mockResolvedValue(category({ id: 99, name: "Suspensão" }));
    vi.mocked(partsApi.createPart).mockResolvedValue(part({ category: 99, category_name: "Suspensão" }));
    const user = userEvent.setup();
    renderSheet();

    await user.type(screen.getByLabelText("Nome da peça"), "Amortecedor dianteiro");

    await user.click(screen.getByRole("button", { name: /adicionar categoria/i }));
    expect(await screen.findByRole("dialog", { name: "Nova categoria" })).toBeInTheDocument();

    // Once the new category is saved, the part form's category list must
    // include it on refetch for the Select to render its label.
    vi.mocked(categoriesApi.listCategories).mockResolvedValue([
      category({ id: 99, name: "Suspensão" }),
    ]);

    await user.type(screen.getByLabelText("Nome"), "Suspensão");
    await user.click(
      within(screen.getByRole("dialog", { name: "Nova categoria" })).getByRole("button", {
        name: "Salvar",
      }),
    );

    await waitFor(() =>
      expect(categoriesApi.createCategory).toHaveBeenCalledWith(
        expect.objectContaining({ category_type: "part", name: "Suspensão" }),
      ),
    );

    // Dialog closed, back on the part form -- no data loss from the earlier field.
    expect(screen.queryByRole("dialog", { name: "Nova categoria" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nome da peça")).toHaveValue("Amortecedor dianteiro");

    // The new category is auto-selected in form state (proven by the payload
    // submitted below), not just visually -- Radix's Select.Value only
    // resolves a label from an Item that has actually mounted, so asserting
    // on the trigger's rendered text here would be a JSDOM-specific flake.

    // Regression guard: submitting the inline category form (nested via the
    // Dialog's Portal inside the part form's own <form>) must not also
    // submit the outer part form as a side effect -- see the identical
    // guard in the inline-supplier test above for why.
    expect(partsApi.createPart).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(partsApi.createPart).toHaveBeenCalledWith(
        expect.objectContaining({ category: 99, name: "Amortecedor dianteiro" }),
      ),
    );
  });

  it("creates a supplier inline and auto-selects it without losing other field values", async () => {
    vi.mocked(suppliersApi.createSupplier).mockResolvedValue(
      supplier({ id: 99, name: "Peças Silva Ltda" }),
    );
    vi.mocked(partsApi.createPart).mockResolvedValue(
      part({ supplier: 99, supplier_name: "Peças Silva Ltda" }),
    );
    const user = userEvent.setup();
    renderSheet();

    await user.type(screen.getByLabelText("Nome da peça"), "Amortecedor dianteiro");
    await user.click(screen.getByLabelText("Categoria da peça"));
    await user.click(await screen.findByRole("option", { name: "Motor" }));

    await user.click(screen.getByRole("button", { name: /adicionar fornecedor/i }));
    expect(await screen.findByRole("dialog", { name: "Novo fornecedor" })).toBeInTheDocument();

    await user.type(
      within(screen.getByRole("dialog", { name: "Novo fornecedor" })).getByLabelText(
        "Nome/Razão social",
      ),
      "Peças Silva Ltda",
    );
    await user.click(
      within(screen.getByRole("dialog", { name: "Novo fornecedor" })).getByRole("button", {
        name: "Salvar",
      }),
    );

    await waitFor(() =>
      expect(suppliersApi.createSupplier).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Peças Silva Ltda", supplier_type: "company" }),
      ),
    );

    // Dialog closed, back on the part form -- no data loss from the earlier fields.
    expect(screen.queryByRole("dialog", { name: "Novo fornecedor" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nome da peça")).toHaveValue("Amortecedor dianteiro");

    // The new supplier is auto-selected and displayed immediately -- unlike
    // the category Select, SupplierCombobox shows `supplierName` directly
    // without waiting on a refetch, so no re-mock of listSuppliers is needed.
    expect(screen.getByText("Peças Silva Ltda")).toBeInTheDocument();

    // Regression guard: SupplierForm is nested (via the Dialog's Portal)
    // inside the part form's own <form> in the React tree. Submitting the
    // inline supplier form must NOT also submit the outer part form as a
    // side effect (React re-dispatches bubbling events along the component
    // tree for portaled content) -- that would silently create a part with
    // supplier left unset, before the user ever clicks the part's own Salvar.
    expect(partsApi.createPart).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(partsApi.createPart).toHaveBeenCalledWith(
        expect.objectContaining({ supplier: 99, name: "Amortecedor dianteiro" }),
      ),
    );
  });
});
