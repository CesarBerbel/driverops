import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import * as customersApi from "@/features/customers/api";
import type { Customer } from "@/features/customers/types";
import * as vehiclesApi from "@/features/vehicles/api";
import { VehicleFormSheet } from "@/features/vehicles/VehicleFormSheet";

vi.mock("@/features/vehicles/api");
vi.mock("@/features/customers/api");

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 1,
    name: "Alice Wonderland",
    customer_type: "individual",
    email: "",
    phone: "",
    whatsapp: "",
    document: "",
    zip_code: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    country: "Brasil",
    notes: "",
    is_active: true,
    vehicle_count: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderSheet(onOpenChange = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <VehicleFormSheet open vehicleId={null} onOpenChange={onOpenChange} />
      <Toaster />
    </QueryClientProvider>,
  );
  return { onOpenChange };
}

async function selectCustomer(user: ReturnType<typeof userEvent.setup>, name = "Alice Wonderland") {
  await user.type(screen.getByPlaceholderText("Buscar cliente pelo nome..."), "ali");
  await user.click(await screen.findByText(name));
}

describe("VehicleFormSheet", () => {
  beforeEach(() => {
    vi.mocked(vehiclesApi.createVehicle).mockReset();
    vi.mocked(customersApi.createCustomer).mockReset();
    vi.mocked(customersApi.listCustomers).mockReset();
    vi.mocked(customersApi.listCustomers).mockResolvedValue([customer()]);
  });

  it("requires a customer and a valid plate before submitting", async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Selecione um cliente.")).toBeInTheDocument();
    expect(screen.getByText("A placa é obrigatória.")).toBeInTheDocument();
    expect(vehiclesApi.createVehicle).not.toHaveBeenCalled();
  });

  it("normalizes a lowercase hyphenated plate as the user types", async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.type(screen.getByLabelText("Placa"), "abc-1234");
    expect(screen.getByLabelText("Placa")).toHaveValue("ABC1234");
  });

  it("rejects a plate matching neither the old nor the Mercosul format", async () => {
    const user = userEvent.setup();
    renderSheet();

    await selectCustomer(user);
    await user.type(screen.getByLabelText("Placa"), "AB123");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(
      await screen.findByText(
        "Placa inválida. Use o padrão antigo (ABC1234) ou Mercosul (ABC1D23).",
      ),
    ).toBeInTheDocument();
    expect(vehiclesApi.createVehicle).not.toHaveBeenCalled();
  });

  it("submits with only the customer and plate filled", async () => {
    vi.mocked(vehiclesApi.createVehicle).mockResolvedValue({
      id: 1,
      customer: 1,
      customer_name: "Alice Wonderland",
      customer_whatsapp: "",
      license_plate: "ABC1234",
      brand: "",
      model: "",
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
    });
    const user = userEvent.setup();
    const { onOpenChange } = renderSheet();

    await selectCustomer(user);
    await user.type(screen.getByLabelText("Placa"), "abc1234");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(vehiclesApi.createVehicle).toHaveBeenCalledWith(
        expect.objectContaining({ customer: 1, license_plate: "ABC1234" }),
      ),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("rejects a model year earlier than the manufacture year", async () => {
    const user = userEvent.setup();
    renderSheet();

    await selectCustomer(user);
    await user.type(screen.getByLabelText("Placa"), "abc1234");
    await user.type(screen.getByLabelText("Ano de fabricação"), "2020");
    await user.type(screen.getByLabelText("Ano do modelo"), "2018");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(
      await screen.findByText("O ano do modelo não pode ser anterior ao ano de fabricação."),
    ).toBeInTheDocument();
    expect(vehiclesApi.createVehicle).not.toHaveBeenCalled();
  });

  it("creates a customer inline and selects it without submitting the vehicle form", async () => {
    vi.mocked(customersApi.createCustomer).mockResolvedValue(
      customer({ id: 7, name: "Bob Builder" }),
    );
    const user = userEvent.setup();
    renderSheet();

    await user.type(screen.getByLabelText("Placa"), "abc1234");
    await user.click(screen.getByRole("button", { name: /adicionar cliente/i }));

    const dialog = await screen.findByRole("dialog", { name: /novo cliente/i });
    await user.type(within(dialog).getByLabelText("Nome"), "Bob Builder");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(customersApi.createCustomer).toHaveBeenCalled());
    // The new customer is selected in the vehicle form and the plate is kept...
    expect(await screen.findByText("Bob Builder")).toBeInTheDocument();
    expect(screen.getByLabelText("Placa")).toHaveValue("ABC1234");
    // ...and the inline save must NOT have submitted the vehicle form.
    expect(vehiclesApi.createVehicle).not.toHaveBeenCalled();
  });

  it("reveals the modification notes field only when the vehicle is marked as modified", async () => {
    const user = userEvent.setup();
    renderSheet();

    expect(screen.queryByLabelText("Observações da modificação")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Veículo modificado"));
    await user.click(screen.getByRole("option", { name: "Sim" }));

    expect(await screen.findByLabelText("Observações da modificação")).toBeInTheDocument();
  });
});
