import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import { VehicleCheckInTab } from "@/features/checkin/VehicleCheckInTab";
import type { CheckIn, Damage } from "@/features/checkin/types";

vi.mock("@/features/checkin/api", () => ({
  getCheckIn: vi.fn(),
  startCheckIn: vi.fn(),
  updateCheckIn: vi.fn(),
  completeCheckIn: vi.fn(),
  reopenCheckIn: vi.fn(),
  setItems: vi.fn(),
  addGeneralPhoto: vi.fn(),
  deleteGeneralPhoto: vi.fn(),
  addBelonging: vi.fn(),
  deleteBelonging: vi.fn(),
  createDamage: vi.fn(),
  updateDamage: vi.fn(),
  deleteDamage: vi.fn(),
  addDamagePhoto: vi.fn(),
  deleteDamagePhoto: vi.fn(),
}));
import * as api from "@/features/checkin/api";

const perms = vi.hoisted(() => ({ codes: new Set<string>() }));
vi.mock("@/features/auth/usePermission", () => ({
  usePermissionCheck: () => (code: string) => perms.codes.has(code),
  useHasPermission: (code: string) => perms.codes.has(code),
}));

function damage(over: Partial<Damage> = {}): Damage {
  return {
    id: 1,
    x: "30",
    y: "40",
    sequence: 1,
    region: "front_left_door",
    region_display: "Porta dianteira esquerda",
    damage_type: "scratch",
    damage_type_display: "Risco",
    severity: "medium",
    severity_display: "Média",
    description: "Risco na porta",
    internal_notes: "",
    visible_to_customer: true,
    photos: [],
    created_by_name: "João",
    created_at: new Date().toISOString(),
    ...over,
  };
}

function checkIn(over: Partial<CheckIn> = {}): CheckIn {
  return {
    id: 5,
    order: 10,
    status: "in_progress",
    status_display: "Em andamento",
    is_locked: false,
    mileage: null,
    fuel_level: "not_checked",
    fuel_level_display: "Não verificado",
    external_condition: "",
    internal_condition: "",
    general_notes: "",
    arrived_driving: true,
    arrived_towed: false,
    customer_present: false,
    customer_confirmed: false,
    belongings_status: "not_verified",
    damages: [],
    photos: [],
    items: [{ id: 1, name: "Estepe", status: "unchecked", notes: "", position: 0 }],
    belongings: [],
    summary: { damage_count: 0, photo_count: 0, absent_items_count: 0, has_belongings: false },
    created_by_name: "João",
    completed_by_name: null,
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...over,
  };
}

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <VehicleCheckInTab orderId={10} />
      <Toaster />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  perms.codes = new Set(["checkin.view", "checkin.edit", "checkin.complete"]);
  vi.mocked(api.getCheckIn).mockResolvedValue(null);
  vi.mocked(api.startCheckIn).mockResolvedValue(checkIn());
  vi.mocked(api.createDamage).mockResolvedValue(checkIn({ damages: [damage()], summary: { damage_count: 1, photo_count: 0, absent_items_count: 0, has_belongings: false } }));
  vi.mocked(api.completeCheckIn).mockResolvedValue(checkIn({ status: "completed", is_locked: true, completed_at: new Date().toISOString(), completed_by_name: "João" }));
  vi.mocked(api.setItems).mockResolvedValue(checkIn());
});

describe("Check-in do veículo", () => {
  it("shows the not-started state and starts the check-in", async () => {
    renderTab();
    expect(await screen.findByText("Check-in ainda não iniciado")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /iniciar check-in/i }));
    await waitFor(() => expect(api.startCheckIn).toHaveBeenCalledWith(10));
  });

  it("blocks users without permission", async () => {
    perms.codes = new Set();
    renderTab();
    expect(
      await screen.findByText("Você não tem permissão para ver o check-in."),
    ).toBeInTheDocument();
  });

  it("renders the map, severity legend and the damage list in sync", async () => {
    vi.mocked(api.getCheckIn).mockResolvedValue(
      checkIn({ damages: [damage()], summary: { damage_count: 1, photo_count: 0, absent_items_count: 0, has_belongings: false } }),
    );
    renderTab();
    // Marcador numerado no mapa + item na lista.
    expect(await screen.findByRole("button", { name: /Avaria 1: Média/ })).toBeInTheDocument();
    expect(screen.getByText("Risco na porta")).toBeInTheDocument();
    expect(screen.getByText("Mapa de avarias")).toBeInTheDocument();
  });

  it("opens the damage form when clicking the car map and creates a damage", async () => {
    vi.mocked(api.getCheckIn).mockResolvedValue(checkIn());
    renderTab();
    await screen.findByText("Mapa de avarias");
    await userEvent.click(screen.getByRole("button", { name: /Mapa do veículo/ }));
    // Abre o drawer "Nova avaria".
    expect(await screen.findByText("Nova avaria")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Descrição *"), "Amassado no capô");
    await userEvent.click(screen.getByRole("button", { name: /Registrar avaria/ }));
    await waitFor(() =>
      expect(api.createDamage).toHaveBeenCalledWith(
        expect.objectContaining({ check_in: 5, description: "Amassado no capô" }),
      ),
    );
  });

  it("completes the check-in", async () => {
    vi.mocked(api.getCheckIn).mockResolvedValue(
      checkIn({ damages: [damage()], summary: { damage_count: 1, photo_count: 0, absent_items_count: 0, has_belongings: false } }),
    );
    renderTab();
    await userEvent.click(await screen.findByRole("button", { name: /Concluir check-in/ }));
    await waitFor(() => expect(api.completeCheckIn).toHaveBeenCalledWith(5, false));
  });

  it("shows locked/reopen when completed and hides edit affordances", async () => {
    perms.codes = new Set(["checkin.view", "checkin.edit", "checkin.reopen"]);
    vi.mocked(api.getCheckIn).mockResolvedValue(
      checkIn({ status: "completed", status_display: "Concluído", is_locked: true, completed_at: new Date().toISOString(), completed_by_name: "João" }),
    );
    renderTab();
    expect(await screen.findByRole("button", { name: "Reabrir" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Concluir check-in/ })).not.toBeInTheDocument();
  });
});
