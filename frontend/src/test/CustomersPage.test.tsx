import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import * as customersApi from "@/features/customers/api";
import { CustomersPage } from "@/features/customers/pages/CustomersPage";
import type { Customer } from "@/features/customers/types";

vi.mock("@/features/customers/api");
vi.mock("@/features/customers/cepService");

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 1,
    name: "Alice Wonderland",
    customer_type: "individual",
    email: "alice@example.com",
    phone: "11987654321",
    document: "",
    zip_code: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "São Paulo",
    state: "SP",
    country: "Brasil",
    notes: "",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CustomersPage />
      <Toaster />
    </QueryClientProvider>,
  );
}

describe("CustomersPage", () => {
  beforeEach(() => {
    vi.mocked(customersApi.listCustomers).mockReset();
    vi.mocked(customersApi.createCustomer).mockReset();
  });

  it("shows the empty state when there are no customers", async () => {
    vi.mocked(customersApi.listCustomers).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("Nenhum cliente cadastrado ainda.")).toBeInTheDocument();
    expect(customersApi.listCustomers).toHaveBeenCalledWith(undefined);
  });

  it("renders customers with formatted phone and city/UF", async () => {
    vi.mocked(customersApi.listCustomers).mockResolvedValue([customer()]);
    renderPage();

    expect(await screen.findByText("Alice Wonderland")).toBeInTheDocument();
    expect(screen.getByText("(11) 98765-4321")).toBeInTheDocument();
    expect(screen.getByText("São Paulo/SP")).toBeInTheDocument();
    expect(screen.getByText("Pessoa Física")).toBeInTheDocument();
  });

  it("debounces the search box and queries by name", async () => {
    vi.mocked(customersApi.listCustomers).mockResolvedValue([customer()]);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Alice Wonderland");
    await user.type(screen.getByPlaceholderText("Buscar cliente pelo nome..."), "ali");

    await waitFor(() => expect(customersApi.listCustomers).toHaveBeenCalledWith("ali"));
  });

  it("shows a distinct empty state and clears back to the full list", async () => {
    vi.mocked(customersApi.listCustomers).mockImplementation((search) =>
      Promise.resolve(search ? [] : [customer()]),
    );
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Alice Wonderland");
    await user.type(screen.getByPlaceholderText("Buscar cliente pelo nome..."), "zzz");

    await screen.findByText('Nenhum cliente encontrado para "zzz".');

    await user.click(screen.getByRole("button", { name: /limpar pesquisa/i }));
    await screen.findByText("Alice Wonderland");
    expect(customersApi.listCustomers).toHaveBeenLastCalledWith(undefined);
  });

  it("shows an error state with a retry button when the query fails", async () => {
    vi.mocked(customersApi.listCustomers).mockRejectedValue(new Error("network"));
    renderPage();

    expect(
      await screen.findByText("Não foi possível carregar os clientes. Tente novamente."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tentar novamente/i })).toBeInTheDocument();
  });

  it("opens the create sheet from the header button and creates a customer", async () => {
    vi.mocked(customersApi.listCustomers).mockResolvedValue([]);
    vi.mocked(customersApi.createCustomer).mockResolvedValue(customer({ name: "New Customer" }));
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Nenhum cliente cadastrado ainda.");
    // Both the header button and the empty-state CTA share this label.
    const [createButton] = screen.getAllByRole("button", { name: "Novo cliente" });
    await user.click(createButton);

    expect(await screen.findByText("Novo cliente", { selector: "[data-slot=sheet-title]" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Nome"), "New Customer");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(customersApi.createCustomer).toHaveBeenCalledWith(
        expect.objectContaining({ name: "New Customer" }),
      ),
    );
  });

  it("opens the edit sheet with the selected customer's data", async () => {
    vi.mocked(customersApi.listCustomers).mockResolvedValue([customer()]);
    vi.mocked(customersApi.getCustomer).mockResolvedValue(customer());
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Alice Wonderland");
    await user.click(screen.getByRole("button", { name: "Editar" }));

    expect(await screen.findByText("Editar cliente")).toBeInTheDocument();
    expect(await screen.findByDisplayValue("Alice Wonderland")).toBeInTheDocument();
  });
});
