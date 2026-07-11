import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, is_superuser: true, permissions: [] } }),
}));

import { VehicleMobileCard } from "@/features/vehicles/components/VehicleMobileCard";
import type { Vehicle } from "@/features/vehicles/types";

function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 3,
    customer: 1,
    customer_name: "Alice Wonderland",
    customer_whatsapp: "",
    license_plate: "ABC1234",
    brand: "Fiat",
    model: "Uno",
    version: "Way 1.0",
    manufacture_year: 2020,
    model_year: 2021,
    color: "Prata",
    mileage: 45000,
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

describe("VehicleMobileCard", () => {
  it("shows the plate, brand/model, customer and calls onOpen from the main action", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <VehicleMobileCard vehicle={vehicle()} onOpen={onOpen} />
      </MemoryRouter>,
    );

    expect(screen.getByText("ABC-1234")).toBeInTheDocument();
    expect(screen.getByText(/Fiat Uno/)).toBeInTheDocument();
    expect(screen.getByText(/Way 1.0/)).toBeInTheDocument();
    expect(screen.getByText("Alice Wonderland")).toBeInTheDocument();
    expect(screen.getByText(/45\.000 km/)).toBeInTheDocument();
    expect(screen.getByText("Prata")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ver veículo" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("omits mileage and color when they are absent", () => {
    render(
      <MemoryRouter>
        <VehicleMobileCard vehicle={vehicle({ mileage: null, color: "" })} />
      </MemoryRouter>,
    );

    expect(screen.queryByText(/km/)).not.toBeInTheDocument();
    expect(screen.queryByText("Prata")).not.toBeInTheDocument();
  });
});
