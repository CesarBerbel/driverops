import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import { CrmPage } from "@/features/crm/pages/CrmPage";
import type { Suggestion } from "@/features/crm/types";
import type { Paginated } from "@/lib/pagination";

vi.mock("@/features/crm/api", () => ({
  listSuggestions: vi.fn(),
  listSuggestionsPage: vi.fn(),
  getPendingCount: vi.fn(),
  approveSuggestion: vi.fn(),
  dismissSuggestion: vi.fn(),
  completeSuggestion: vi.fn(),
  snoozeSuggestion: vi.fn(),
  markSent: vi.fn(),
  generateMessage: vi.fn(),
  toTask: vi.fn(),
  toCampaign: vi.fn(),
  updateSuggestion: vi.fn(),
}));
import * as api from "@/features/crm/api";

const perms = vi.hoisted(() => ({
  codes: new Set<string>(["crm.view", "crm.manage", "crm.use_ai", "crm.dismiss", "crm.send_message"]),
}));
vi.mock("@/features/auth/usePermission", () => ({
  usePermissionCheck: () => (code: string) => perms.codes.has(code),
  useHasPermission: (code: string) => perms.codes.has(code),
}));

function suggestion(over: Partial<Suggestion> = {}): Suggestion {
  return {
    id: 1,
    suggestion_type: "quote_followup",
    suggestion_type_display: "Follow-up de orçamento",
    category: "quote",
    category_display: "Orçamento",
    priority: "high",
    priority_display: "Alta",
    status: "new",
    status_display: "Nova",
    reason: "Orçamento #12 enviado há 3 dias sem resposta.",
    recommended_action: "Enviar mensagem cordial perguntando se há dúvidas.",
    suggested_text: "Olá, Maria. Ficou alguma dúvida sobre o orçamento?",
    channel: "whatsapp",
    channel_display: "WhatsApp",
    due_date: null,
    snoozed_until: null,
    source: "rule",
    customer: 5,
    customer_name: "Maria Silva",
    customer_phone: "11988887777",
    customer_whatsapp: "11988887777",
    customer_email: "",
    vehicle_plate: "ABC1D23",
    work_order: 12,
    work_order_number: 12,
    quote: 3,
    quote_number: 3,
    lead: null,
    assigned_to: null,
    assigned_to_name: null,
    events: [],
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...over,
  };
}

// Envelope paginado do backend a partir de uma lista de sugestões.
function paged(items: Suggestion[]): Paginated<Suggestion> {
  return { count: items.length, next: null, previous: null, results: items };
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <CrmPage />
      </MemoryRouter>
      <Toaster />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  perms.codes = new Set(["crm.view", "crm.manage", "crm.use_ai", "crm.dismiss", "crm.send_message"]);
  vi.mocked(api.listSuggestionsPage).mockResolvedValue(paged([suggestion()]));
  vi.mocked(api.approveSuggestion).mockResolvedValue(suggestion({ status: "in_analysis" }));
  vi.mocked(api.generateMessage).mockResolvedValue({ text: "Mensagem gerada pela IA.", ai_used: true });
});

describe("CRM — Próximas Ações", () => {
  it("blocks users without permission", async () => {
    perms.codes = new Set();
    renderPage();
    expect(
      await screen.findByText("Você não tem permissão para ver o CRM inteligente."),
    ).toBeInTheDocument();
  });

  it("lists suggestions with type, reason and priority", async () => {
    renderPage();
    expect(await screen.findByText("Follow-up de orçamento")).toBeInTheDocument();
    expect(screen.getByText(/enviado há 3 dias sem resposta/)).toBeInTheDocument();
    expect(screen.getByText("Alta")).toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    vi.mocked(api.listSuggestionsPage).mockResolvedValue(paged([]));
    renderPage();
    expect(await screen.findByText(/Nenhuma sugestão inteligente agora/)).toBeInTheDocument();
  });

  it("approves a suggestion", async () => {
    renderPage();
    await screen.findByText("Follow-up de orçamento");
    await userEvent.click(screen.getByRole("button", { name: /Aprovar/ }));
    await waitFor(() => expect(api.approveSuggestion).toHaveBeenCalledWith(1));
  });

  it("generates an AI message in the dialog", async () => {
    renderPage();
    await screen.findByText("Follow-up de orçamento");
    await userEvent.click(screen.getByRole("button", { name: /Mensagem/ }));
    expect(await screen.findByText("Mensagem sugerida")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Gerar com IA/ }));
    await waitFor(() => expect(api.generateMessage).toHaveBeenCalledWith(1));
    expect(await screen.findByDisplayValue("Mensagem gerada pela IA.")).toBeInTheDocument();
  });

  it("opens the action message from a notification deep link", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/crm?suggestion=1"]}>
          <CrmPage />
        </MemoryRouter>
        <Toaster />
      </QueryClientProvider>,
    );
    // A mensagem sugerida da ação abre automaticamente.
    expect(await screen.findByText("Mensagem sugerida")).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Ficou alguma dúvida sobre o orçamento/)).toBeInTheDocument();
  });

  it("hides AI generation without the use_ai permission", async () => {
    perms.codes = new Set(["crm.view"]);
    renderPage();
    await screen.findByText("Follow-up de orçamento");
    await userEvent.click(screen.getByRole("button", { name: /Mensagem/ }));
    await screen.findByText("Mensagem sugerida");
    expect(screen.queryByRole("button", { name: /Gerar com IA/ })).not.toBeInTheDocument();
  });
});
