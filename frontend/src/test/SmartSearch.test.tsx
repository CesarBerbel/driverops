import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/smart-search/api");
import * as api from "@/features/smart-search/api";
import { SmartSearchProvider } from "@/features/smart-search/SmartSearchProvider";
import { SmartSearchTrigger } from "@/features/smart-search/SmartSearchTrigger";
import type { SmartSearchResponse } from "@/features/smart-search/types";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SmartSearchProvider>{ui}</SmartSearchProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function response(overrides: Partial<SmartSearchResponse> = {}): SmartSearchResponse {
  return {
    query: "OS com luz de freio",
    interpreted: { entities: [], period: null, statuses: [], terms: ["freio"] },
    applied_filters: [{ label: "Texto", value: "freio" }],
    used_ai: false,
    total: 2,
    truncated: false,
    results: [],
    groups: [
      {
        type: "work_order",
        label: "Ordens de Serviço",
        results: [
          {
            type: "work_order",
            id: 245,
            title: "OS #245",
            subtitle: "Honda Civic ABC1D23 · João Silva",
            status: "Em diagnóstico",
            date: "2026-07-09",
            snippet: "a luz de freio permanece acesa",
            reason: "Encontrado no relato do cliente.",
            url: "/orders/245",
            score: 3,
          },
        ],
      },
      {
        type: "vehicle",
        label: "Veículos",
        results: [
          {
            type: "vehicle",
            id: 7,
            title: "Honda Civic",
            subtitle: "ABC1D23 · João Silva",
            status: null,
            date: null,
            snippet: "",
            reason: "Encontrado pelos dados do veículo.",
            url: "/vehicles",
            score: 1,
          },
        ],
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getSearchSuggestions).mockResolvedValue({
    starters: ["OS aguardando aprovação"],
    saved: [],
  });
  vi.mocked(api.getRecentSearches).mockResolvedValue([]);
});

async function openAndSearch(user: ReturnType<typeof userEvent.setup>, query: string) {
  await user.click(screen.getByRole("button", { name: /busca inteligente/i }));
  const input = await screen.findByLabelText("Busca inteligente");
  await user.type(input, `${query}{Enter}`);
}

describe("SmartSearch", () => {
  it("opens the dialog and shows the initial empty state with suggestions", async () => {
    const user = userEvent.setup();
    wrap(<SmartSearchTrigger />);
    await user.click(screen.getByRole("button", { name: /busca inteligente/i }));
    expect(await screen.findByText(/Digite o que deseja encontrar/i)).toBeInTheDocument();
    expect(screen.getByText("OS aguardando aprovação")).toBeInTheDocument();
  });

  it("renders results grouped by entity with reason and snippet", async () => {
    vi.mocked(api.smartSearch).mockResolvedValue(response());
    const user = userEvent.setup();
    wrap(<SmartSearchTrigger />);
    await openAndSearch(user, "OS com luz de freio");

    expect(await screen.findByText("OS #245")).toBeInTheDocument();
    expect(screen.getByText("Ordens de Serviço · 1")).toBeInTheDocument();
    expect(screen.getByText("Veículos · 1")).toBeInTheDocument();
    expect(screen.getByText("Encontrado no relato do cliente.")).toBeInTheDocument();
    expect(screen.getByText(/luz de freio permanece acesa/)).toBeInTheDocument();
    // Filtros aplicados exibidos.
    expect(screen.getByText("freio")).toBeInTheDocument();
  });

  it("navigates to the result url on click", async () => {
    vi.mocked(api.smartSearch).mockResolvedValue(response());
    const user = userEvent.setup();
    wrap(<SmartSearchTrigger />);
    await openAndSearch(user, "OS com luz de freio");
    await user.click(await screen.findByText("OS #245"));
    expect(mockNavigate).toHaveBeenCalledWith("/orders/245");
  });

  it("shows the empty state when there are no results", async () => {
    vi.mocked(api.smartSearch).mockResolvedValue(
      response({ total: 0, groups: [], results: [] }),
    );
    const user = userEvent.setup();
    wrap(<SmartSearchTrigger />);
    await openAndSearch(user, "helicóptero solar");
    expect(
      await screen.findByText(/Não encontrei resultados para essa busca/i),
    ).toBeInTheDocument();
  });

  it("shows an error state with fallback message when the search fails", async () => {
    vi.mocked(api.smartSearch).mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();
    wrap(<SmartSearchTrigger />);
    await openAndSearch(user, "qualquer coisa");
    expect(
      await screen.findByText(/Não foi possível concluir a busca/i),
    ).toBeInTheDocument();
  });

  it("lists saved searches in the initial state", async () => {
    vi.mocked(api.getSearchSuggestions).mockResolvedValue({
      starters: ["OS aguardando aprovação"],
      saved: [
        { id: 3, label: "OS atrasadas", query: "OS atrasadas", filters: {}, created_at: "2026-07-01" },
      ],
    });
    const user = userEvent.setup();
    wrap(<SmartSearchTrigger />);
    await user.click(screen.getByRole("button", { name: /busca inteligente/i }));
    expect(await screen.findByText("Pesquisas salvas")).toBeInTheDocument();
    expect(screen.getByText("OS atrasadas")).toBeInTheDocument();
  });

  it("saves the current search", async () => {
    vi.mocked(api.smartSearch).mockResolvedValue(response());
    vi.mocked(api.saveSearch).mockResolvedValue({
      id: 9,
      label: "OS com luz de freio",
      query: "OS com luz de freio",
      filters: {},
      created_at: "2026-07-01",
    });
    const user = userEvent.setup();
    wrap(<SmartSearchTrigger />);
    await openAndSearch(user, "OS com luz de freio");
    const saveBtn = await screen.findByRole("button", { name: /salvar busca/i });
    await user.click(saveBtn);
    expect(api.saveSearch).toHaveBeenCalledWith({
      label: "OS com luz de freio",
      query: "OS com luz de freio",
    });
  });
});
