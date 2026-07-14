import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, is_superuser: true, permissions: [] } }),
}));

import { Toaster } from "@/components/ui/sonner";
import * as suppliersApi from "@/features/suppliers/api";
import { SuppliersPage } from "@/features/suppliers/pages/SuppliersPage";
import type { Supplier } from "@/features/suppliers/types";
import type { Paginated } from "@/lib/pagination";

vi.mock("@/features/suppliers/api");
vi.mock("@/lib/cepService");

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

// Envelope paginado do backend a partir de uma lista de fornecedores.
function paged(items: Supplier[]): Paginated<Supplier> {
  return { count: items.length, next: null, previous: null, results: items };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SuppliersPage />
      <Toaster />
    </QueryClientProvider>,
  );
}

describe("SuppliersPage", () => {
  beforeEach(() => {
    vi.mocked(suppliersApi.listSuppliersPage).mockReset();
    vi.mocked(suppliersApi.deleteSupplier).mockReset();
    vi.mocked(suppliersApi.reactivateSupplier).mockReset();
  });

  it("renders the heading and 'Novo fornecedor' button", async () => {
    vi.mocked(suppliersApi.listSuppliersPage).mockResolvedValue(paged([]));
    renderPage();

    expect(await screen.findByRole("heading", { name: "Fornecedores" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /novo fornecedor/i }).length).toBeGreaterThan(0);
  });

  it("shows the empty state when there are no suppliers", async () => {
    vi.mocked(suppliersApi.listSuppliersPage).mockResolvedValue(paged([]));
    renderPage();

    expect(await screen.findByText("Nenhum fornecedor cadastrado ainda.")).toBeInTheDocument();
    expect(suppliersApi.listSuppliersPage).toHaveBeenCalledWith(1, {
      search: undefined,
      status: "active",
    });
  });

  it("lists suppliers with name, trade name, type, and document", async () => {
    vi.mocked(suppliersApi.listSuppliersPage).mockResolvedValue(
      paged([supplier({ trade_name: "Peças Silva", document: "12345678000199" })]),
    );
    renderPage();

    const table = await screen.findByRole("table");
    expect(within(table).getByText("Fornecedor Ltda")).toBeInTheDocument();
    expect(within(table).getByText("Peças Silva")).toBeInTheDocument();
    expect(within(table).getByText("Pessoa Jurídica")).toBeInTheDocument();
    expect(within(table).getByText("12345678000199")).toBeInTheDocument();
  });

  it("shows a WhatsApp click-to-chat link for the supplier's number", async () => {
    vi.mocked(suppliersApi.listSuppliersPage).mockResolvedValue(
      paged([supplier({ whatsapp: "12988887777" })]),
    );
    renderPage();

    await screen.findByText("Fornecedor Ltda");
    const links = screen.getAllByRole("link");
    expect(
      links.some((a) => a.getAttribute("href") === "https://wa.me/5512988887777"),
    ).toBe(true);
  });

  it("debounces the search box and queries by name/trade name/document", async () => {
    vi.mocked(suppliersApi.listSuppliersPage).mockResolvedValue(paged([supplier()]));
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Fornecedor Ltda");
    await user.type(
      screen.getByPlaceholderText("Buscar por nome, nome fantasia ou documento..."),
      "forn",
    );

    await waitFor(() =>
      expect(suppliersApi.listSuppliersPage).toHaveBeenLastCalledWith(1, {
        search: "forn",
        status: "active",
      }),
    );
  });

  it("clears the search box and refetches unfiltered", async () => {
    vi.mocked(suppliersApi.listSuppliersPage).mockResolvedValue(paged([supplier()]));
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Fornecedor Ltda");
    await user.type(
      screen.getByPlaceholderText("Buscar por nome, nome fantasia ou documento..."),
      "x",
    );
    await user.click(screen.getByRole("button", { name: /limpar pesquisa/i }));

    await waitFor(() =>
      expect(suppliersApi.listSuppliersPage).toHaveBeenLastCalledWith(1, {
        search: undefined,
        status: "active",
      }),
    );
  });

  it("shows a distinct empty state for a search with no results", async () => {
    vi.mocked(suppliersApi.listSuppliersPage).mockImplementation((_page, params) =>
      Promise.resolve(paged(params?.search ? [] : [supplier()])),
    );
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Fornecedor Ltda");
    await user.type(
      screen.getByPlaceholderText("Buscar por nome, nome fantasia ou documento..."),
      "zzz",
    );

    await screen.findByText('Nenhum fornecedor encontrado para "zzz".');
  });

  it("switches to the inactive filter and shows Reativar instead of Excluir", async () => {
    vi.mocked(suppliersApi.listSuppliersPage).mockResolvedValue(paged([supplier()]));
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Fornecedor Ltda");
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Fornecedores desabilitados" }));

    await waitFor(() =>
      expect(suppliersApi.listSuppliersPage).toHaveBeenLastCalledWith(1, {
        search: undefined,
        status: "inactive",
      }),
    );
    expect(screen.getByLabelText("Reativar fornecedor")).toBeInTheDocument();
    expect(screen.queryByLabelText("Excluir fornecedor")).not.toBeInTheDocument();
  });

  it("soft-deletes a supplier through the confirm dialog", async () => {
    vi.mocked(suppliersApi.listSuppliersPage).mockResolvedValue(paged([supplier()]));
    vi.mocked(suppliersApi.deleteSupplier).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Fornecedor Ltda");
    await user.click(screen.getByLabelText("Excluir fornecedor"));
    await user.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(() =>
      expect(suppliersApi.deleteSupplier).toHaveBeenCalledWith(1, expect.anything()),
    );
  });

  it("reactivates a supplier from the inactive list", async () => {
    vi.mocked(suppliersApi.listSuppliersPage).mockResolvedValue(paged([supplier({ id: 2 })]));
    vi.mocked(suppliersApi.reactivateSupplier).mockResolvedValue(supplier({ id: 2 }));
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Fornecedor Ltda");
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Fornecedores desabilitados" }));

    await user.click(await screen.findByLabelText("Reativar fornecedor"));

    await waitFor(() =>
      expect(suppliersApi.reactivateSupplier).toHaveBeenCalledWith(2, expect.anything()),
    );
  });
});
