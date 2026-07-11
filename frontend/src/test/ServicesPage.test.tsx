import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, is_superuser: true, permissions: [] } }),
}));

import { Toaster } from "@/components/ui/sonner";
import * as categoriesApi from "@/features/categories/api";
import * as servicesApi from "@/features/services/api";
import { ServicesPage } from "@/features/services/pages/ServicesPage";
import type { Service } from "@/features/services/types";
import type { Paginated } from "@/lib/pagination";

vi.mock("@/features/services/api");
vi.mock("@/features/categories/api");
vi.mock("@/features/parts/api");

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

// Envelope paginado do backend a partir de uma lista de serviços.
function paged(items: Service[]): Paginated<Service> {
  return { count: items.length, next: null, previous: null, results: items };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/services"]}>
        <ServicesPage />
      </MemoryRouter>
      <Toaster />
    </QueryClientProvider>,
  );
}

describe("ServicesPage", () => {
  beforeEach(() => {
    vi.mocked(servicesApi.listServicesPage).mockReset();
    vi.mocked(servicesApi.deleteService).mockReset();
    vi.mocked(servicesApi.reactivateService).mockReset();
    vi.mocked(categoriesApi.listCategories).mockReset();
    vi.mocked(categoriesApi.listCategories).mockResolvedValue([]);
  });

  it("renders the heading and 'Novo serviço' button", async () => {
    vi.mocked(servicesApi.listServicesPage).mockResolvedValue(paged([]));
    renderPage();
    expect(await screen.findByRole("heading", { name: "Serviços" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /novo serviço/i }).length).toBeGreaterThan(0);
  });

  it("shows the empty state and queries active by default", async () => {
    vi.mocked(servicesApi.listServicesPage).mockResolvedValue(paged([]));
    renderPage();
    expect(await screen.findByText("Nenhum serviço cadastrado ainda.")).toBeInTheDocument();
    expect(servicesApi.listServicesPage).toHaveBeenCalledWith(1, {
      search: undefined,
      status: "active",
      category: undefined,
    });
  });

  it("lists services with category and value", async () => {
    vi.mocked(servicesApi.listServicesPage).mockResolvedValue(
      paged([service({ value: "250.00" })]),
    );
    renderPage();
    const table = await screen.findByRole("table");
    expect(within(table).getByText("Troca de óleo")).toBeInTheDocument();
    expect(within(table).getByText("Mecânica")).toBeInTheDocument();
    expect(within(table).getByText("R$ 250,00")).toBeInTheDocument();
  });

  it("debounces the search box and queries by the typed value", async () => {
    vi.mocked(servicesApi.listServicesPage).mockResolvedValue(paged([service()]));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Troca de óleo");
    await user.type(screen.getByPlaceholderText("Buscar por nome ou categoria..."), "óleo");
    await waitFor(() =>
      expect(servicesApi.listServicesPage).toHaveBeenLastCalledWith(1, {
        search: "óleo",
        status: "active",
        category: undefined,
      }),
    );
  });

  it("switches to the inactive filter and shows Reativar instead of Excluir", async () => {
    vi.mocked(servicesApi.listServicesPage).mockResolvedValue(paged([service()]));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Troca de óleo");
    // The status filter is the last combobox on the page.
    const combos = screen.getAllByRole("combobox");
    await user.click(combos[combos.length - 1]);
    await user.click(screen.getByRole("option", { name: "Serviços desabilitados" }));
    await waitFor(() =>
      expect(servicesApi.listServicesPage).toHaveBeenLastCalledWith(1, {
        search: undefined,
        status: "inactive",
        category: undefined,
      }),
    );
    expect(screen.getByLabelText("Reativar serviço")).toBeInTheDocument();
    expect(screen.queryByLabelText("Excluir serviço")).not.toBeInTheDocument();
  });

  it("soft-deletes a service through the confirm dialog", async () => {
    vi.mocked(servicesApi.listServicesPage).mockResolvedValue(paged([service()]));
    vi.mocked(servicesApi.deleteService).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Troca de óleo");
    await user.click(screen.getByLabelText("Excluir serviço"));
    await user.click(screen.getByRole("button", { name: "Excluir" }));
    await waitFor(() =>
      expect(servicesApi.deleteService).toHaveBeenCalledWith(1, expect.anything()),
    );
  });

  it("reactivates a service from the inactive list", async () => {
    vi.mocked(servicesApi.listServicesPage).mockResolvedValue(paged([service({ id: 2 })]));
    vi.mocked(servicesApi.reactivateService).mockResolvedValue(service({ id: 2 }));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Troca de óleo");
    const combos = screen.getAllByRole("combobox");
    await user.click(combos[combos.length - 1]);
    await user.click(screen.getByRole("option", { name: "Serviços desabilitados" }));
    await user.click(await screen.findByLabelText("Reativar serviço"));
    await waitFor(() =>
      expect(servicesApi.reactivateService).toHaveBeenCalledWith(2, expect.anything()),
    );
  });
});
