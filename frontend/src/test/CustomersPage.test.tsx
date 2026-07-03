import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import * as customersApi from "@/features/customers/api";
import { CustomersPage } from "@/features/customers/pages/CustomersPage";
import type { Customer } from "@/features/customers/types";
import * as vehiclesApi from "@/features/vehicles/api";
import type { Vehicle } from "@/features/vehicles/types";

vi.mock("@/features/customers/api");
vi.mock("@/features/vehicles/api");

function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 1,
    customer: 1,
    customer_name: "Alice Wonderland",
    customer_whatsapp: "",
    license_plate: "ABC1234",
    brand: "Fiat",
    model: "Uno",
    version: "",
    manufacture_year: null,
    model_year: null,
    color: "",
    mileage: null,
    fuel_type: "",
    transmission: "",
    steering: "",
    doors: null,
    air_conditioning: null,
    is_modified: null,
    modification_notes: "",
    vehicle_type: "",
    usage_category: "",
    chassis: "",
    renavam: "",
    fipe_code: "",
    notes: "",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}
vi.mock("@/features/customers/cepService");

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 1,
    name: "Alice Wonderland",
    customer_type: "individual",
    email: "alice@example.com",
    phone: "11987654321",
    whatsapp: "",
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
    vehicle_count: 0,
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

  it("renders the WhatsApp number as a wa.me link when present", async () => {
    vi.mocked(customersApi.listCustomers).mockResolvedValue([
      customer({ whatsapp: "11912345678" }),
    ]);
    renderPage();

    const link = await screen.findByRole("link", { name: /\(11\) 91234-5678/ });
    expect(link).toHaveAttribute("href", "https://wa.me/5511912345678");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("shows a dash instead of a link when there is no WhatsApp number", async () => {
    vi.mocked(customersApi.listCustomers).mockResolvedValue([customer({ whatsapp: "" })]);
    const { container } = renderPage();

    await screen.findByText("Alice Wonderland");
    expect(container.querySelector('a[href*="wa.me"]')).not.toBeInTheDocument();
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

  it("shows a disabled car icon with a zero count and does not fetch vehicles on click", async () => {
    vi.mocked(customersApi.listCustomers).mockResolvedValue([customer({ vehicle_count: 0 })]);
    const user = userEvent.setup();
    renderPage();

    const carButton = await screen.findByLabelText("0 veículo(s) vinculados");
    expect(carButton).toBeDisabled();

    await user.click(carButton);
    expect(vehiclesApi.listVehicles).not.toHaveBeenCalled();
  });

  it("opens the vehicle directly when the customer has exactly one vehicle", async () => {
    vi.mocked(customersApi.listCustomers).mockResolvedValue([customer({ vehicle_count: 1 })]);
    vi.mocked(vehiclesApi.listVehicles).mockResolvedValue([vehicle()]);
    vi.mocked(vehiclesApi.getVehicle).mockResolvedValue(vehicle());
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByLabelText("1 veículo(s) vinculados"));

    await waitFor(() =>
      expect(vehiclesApi.listVehicles).toHaveBeenCalledWith({ customerId: 1 }),
    );
    expect(await screen.findByText("Editar veículo")).toBeInTheDocument();
    expect(await screen.findByDisplayValue("ABC1234")).toBeInTheDocument();
  });

  it("shows a picker dialog when the customer has more than one vehicle", async () => {
    vi.mocked(customersApi.listCustomers).mockResolvedValue([customer({ vehicle_count: 2 })]);
    vi.mocked(vehiclesApi.listVehicles).mockResolvedValue([
      vehicle({ id: 1, license_plate: "ABC1234" }),
      vehicle({ id: 2, license_plate: "XYZ9876" }),
    ]);
    vi.mocked(vehiclesApi.getVehicle).mockResolvedValue(vehicle({ id: 2, license_plate: "XYZ9876" }));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByLabelText("2 veículo(s) vinculados"));

    expect(await screen.findByText("Selecione um veículo")).toBeInTheDocument();
    expect(screen.getByText("ABC-1234")).toBeInTheDocument();
    expect(screen.getByText("XYZ-9876")).toBeInTheDocument();

    await user.click(screen.getByText("XYZ-9876"));

    expect(await screen.findByText("Editar veículo")).toBeInTheDocument();
    expect(await screen.findByDisplayValue("XYZ9876")).toBeInTheDocument();
  });
});
