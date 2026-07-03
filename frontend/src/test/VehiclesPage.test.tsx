import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import * as vehiclesApi from "@/features/vehicles/api";
import { VehiclesPage } from "@/features/vehicles/pages/VehiclesPage";
import type { Vehicle } from "@/features/vehicles/types";

vi.mock("@/features/vehicles/api");
vi.mock("@/features/customers/api");

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
    manufacture_year: 2020,
    model_year: 2021,
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

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <VehiclesPage />
      <Toaster />
    </QueryClientProvider>,
  );
}

describe("VehiclesPage", () => {
  beforeEach(() => {
    vi.mocked(vehiclesApi.listVehicles).mockReset();
    vi.mocked(vehiclesApi.deleteVehicle).mockReset();
    vi.mocked(vehiclesApi.reactivateVehicle).mockReset();
  });

  it("shows the empty state when there are no vehicles", async () => {
    vi.mocked(vehiclesApi.listVehicles).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("Nenhum veículo cadastrado ainda.")).toBeInTheDocument();
    expect(vehiclesApi.listVehicles).toHaveBeenCalledWith({
      search: undefined,
      status: "active",
    });
  });

  it("renders the plate with its display hyphen, the customer, and the model year", async () => {
    vi.mocked(vehiclesApi.listVehicles).mockResolvedValue([vehicle()]);
    renderPage();

    const table = await screen.findByRole("table");
    expect(within(table).getByText("ABC-1234")).toBeInTheDocument();
    expect(within(table).getByText("Alice Wonderland")).toBeInTheDocument();
    expect(within(table).getByText("Fiat Uno")).toBeInTheDocument();
    expect(within(table).getByText("2021")).toBeInTheDocument();
  });

  it("renders the customer's WhatsApp number as a clickable wa.me link next to the name", async () => {
    vi.mocked(vehiclesApi.listVehicles).mockResolvedValue([
      vehicle({ customer_whatsapp: "11912345678" }),
    ]);
    renderPage();

    const table = await screen.findByRole("table");
    const link = within(table).getByRole("link", { name: /\(11\) 91234-5678/ });
    expect(link).toHaveAttribute("href", "https://wa.me/5511912345678");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("does not render a WhatsApp link when the customer has none", async () => {
    vi.mocked(vehiclesApi.listVehicles).mockResolvedValue([vehicle({ customer_whatsapp: "" })]);
    const { container } = renderPage();

    await screen.findByText("Alice Wonderland");
    expect(container.querySelector('a[href*="wa.me"]')).not.toBeInTheDocument();
  });

  it("debounces the search box and queries by plate/customer/brand/model", async () => {
    vi.mocked(vehiclesApi.listVehicles).mockResolvedValue([vehicle()]);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("ABC-1234");
    await user.type(
      screen.getByPlaceholderText("Buscar por placa, cliente, marca ou modelo..."),
      "abc",
    );

    await waitFor(() =>
      expect(vehiclesApi.listVehicles).toHaveBeenLastCalledWith({
        search: "abc",
        status: "active",
      }),
    );
  });

  it("switches to the inactive filter and shows Reativar instead of Excluir", async () => {
    vi.mocked(vehiclesApi.listVehicles).mockResolvedValue([vehicle()]);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("ABC-1234");
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Veículos desabilitados" }));

    await waitFor(() =>
      expect(vehiclesApi.listVehicles).toHaveBeenLastCalledWith({
        search: undefined,
        status: "inactive",
      }),
    );
    expect(screen.getByLabelText("Reativar veículo")).toBeInTheDocument();
    expect(screen.queryByLabelText("Excluir veículo")).not.toBeInTheDocument();
  });

  it("soft-deletes a vehicle through the confirm dialog", async () => {
    vi.mocked(vehiclesApi.listVehicles).mockResolvedValue([vehicle()]);
    vi.mocked(vehiclesApi.deleteVehicle).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("ABC-1234");
    await user.click(screen.getByLabelText("Excluir veículo"));
    await user.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(() =>
      expect(vehiclesApi.deleteVehicle).toHaveBeenCalledWith(1, expect.anything()),
    );
  });

  it("reactivates a vehicle from the inactive list", async () => {
    vi.mocked(vehiclesApi.listVehicles).mockResolvedValue([vehicle({ id: 2 })]);
    vi.mocked(vehiclesApi.reactivateVehicle).mockResolvedValue(vehicle({ id: 2 }));
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("ABC-1234");
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Veículos desabilitados" }));

    await user.click(await screen.findByLabelText("Reativar veículo"));

    await waitFor(() =>
      expect(vehiclesApi.reactivateVehicle).toHaveBeenCalledWith(2, expect.anything()),
    );
  });
});
