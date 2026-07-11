import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import { LeadDetailPage } from "@/features/leads/pages/LeadDetailPage";
import { LeadInboxPage } from "@/features/leads/pages/LeadInboxPage";
import type { LeadDetail, LeadListItem } from "@/features/leads/types";
import type { Paginated } from "@/lib/pagination";

vi.mock("@/features/leads/api", () => ({
  listLeadsPage: vi.fn(),
  getLead: vi.fn(),
  getLeadsPendingCount: vi.fn(),
  leadActions: {
    note: vi.fn(),
    contact: vi.fn(),
    setStatus: vi.fn(),
    markDuplicate: vi.fn(),
    cancel: vi.fn(),
    linkCustomer: vi.fn(),
    createCustomer: vi.fn(),
    updateCustomer: vi.fn(),
    linkVehicle: vi.fn(),
    createVehicle: vi.fn(),
    convertOs: vi.fn(),
    convertQuote: vi.fn(),
  },
}));
import * as api from "@/features/leads/api";

const perms = vi.hoisted(() => ({ codes: new Set<string>(["leads.view", "leads.attend", "leads.convert"]) }));
vi.mock("@/features/auth/usePermission", () => ({
  usePermissionCheck: () => (code: string) => perms.codes.has(code),
  useHasPermission: (code: string) => perms.codes.has(code),
}));

function listItem(over: Partial<LeadListItem> = {}): LeadListItem {
  return {
    id: 1,
    name: "João Souza",
    phone: "11999998888",
    email: "",
    vehicle_plate: "ABC1D23",
    vehicle_brand: "VW",
    vehicle_model: "Gol",
    vehicle_year: 2020,
    request_type: "diagnostic",
    request_type_display: "Diagnóstico",
    best_period: "any",
    best_period_display: "Qualquer horário",
    desired_date: null,
    status: "new",
    status_display: "Novo",
    assigned_to: null,
    assigned_to_name: null,
    created_at: new Date().toISOString(),
    indicators: {
      customer_existing: false,
      vehicle_existing: true,
      vehicle_divergent: true,
      has_open_os: false,
    },
    ...over,
  };
}

// Envelope paginado do backend a partir de uma lista de pedidos.
function paged(items: LeadListItem[]): Paginated<LeadListItem> {
  return { count: items.length, next: null, previous: null, results: items };
}

function detail(): LeadDetail {
  return {
    ...listItem(),
    message: "Barulho na frente",
    document: "",
    vehicle_mileage: null,
    consent: true,
    source: "site",
    updated_at: new Date().toISOString(),
    linked_customer: { id: 5, name: "Maria Silva", phone: "11988887777", whatsapp: "11988887777" },
    linked_vehicle: { id: 9, license_plate: "ABC1D23", brand: "VW", model: "Gol", customer_id: 7 },
    work_order: null,
    analysis: {
      customer_match: { confidence: "high", customer: { id: 5, name: "Maria Silva" }, candidates: [] },
      vehicle_match: {
        found: true,
        vehicle: { id: 9, license_plate: "ABC1D23", brand: "VW", model: "Gol", year: 2020 },
        owner: { id: 7, name: "Pedro" },
      },
      verification: "divergent",
      vehicle_belongs_to_other_customer: true,
    },
    events: [],
  };
}

function renderInbox() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LeadInboxPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderDetail() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/leads/1"]}>
        <Routes>
          <Route path="/leads/:id" element={<LeadDetailPage />} />
        </Routes>
      </MemoryRouter>
      <Toaster />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  perms.codes = new Set(["leads.view", "leads.attend", "leads.convert"]);
  vi.mocked(api.listLeadsPage).mockResolvedValue(paged([listItem()]));
  vi.mocked(api.getLead).mockResolvedValue(detail());
  vi.mocked(api.leadActions.convertOs).mockResolvedValue(detail());
});

describe("Pedidos do Site — inbox", () => {
  it("lists leads with indicators", async () => {
    renderInbox();
    expect(await screen.findByText("João Souza")).toBeInTheDocument();
    expect(screen.getByText("Cliente novo")).toBeInTheDocument();
    expect(screen.getByText("Veículo divergente")).toBeInTheDocument();
  });
});

describe("Pedidos do Site — detalhe", () => {
  it("shows the divergence alert and converts to OS", async () => {
    renderDetail();
    await screen.findByRole("heading", { name: "João Souza" });
    expect(
      screen.getByText(/já está cadastrado para outro cliente/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Gerar OS/ }));
    await waitFor(() => expect(api.leadActions.convertOs).toHaveBeenCalledWith(1, false));
  });

  it("hides conversion actions without the convert permission", async () => {
    perms.codes = new Set(["leads.view", "leads.attend"]);
    renderDetail();
    await screen.findByRole("heading", { name: "João Souza" });
    expect(screen.queryByRole("button", { name: /Gerar OS/ })).not.toBeInTheDocument();
  });
});
