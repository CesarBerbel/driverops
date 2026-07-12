import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import { OrderCrmTab } from "@/features/crm/OrderCrmTab";
import type { Suggestion } from "@/features/crm/types";

vi.mock("@/features/crm/api", () => ({
  listSuggestions: vi.fn(),
  approveSuggestion: vi.fn(),
  dismissSuggestion: vi.fn(),
  completeSuggestion: vi.fn(),
  snoozeSuggestion: vi.fn(),
  toTask: vi.fn(),
  toCampaign: vi.fn(),
  generateMessage: vi.fn(),
}));
import * as api from "@/features/crm/api";

const perms = vi.hoisted(() => ({
  codes: new Set<string>(["crm.view", "crm.manage", "crm.send_message", "crm.dismiss"]),
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
    suggested_text: "Olá, ficou alguma dúvida?",
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

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <OrderCrmTab workOrderId={12} />
      </MemoryRouter>
      <Toaster />
    </QueryClientProvider>,
  );
}

describe("OrderCrmTab", () => {
  beforeEach(() => vi.mocked(api.listSuggestions).mockReset());

  it("lists the CRM suggestions linked to the work order", async () => {
    vi.mocked(api.listSuggestions).mockResolvedValue([suggestion()]);
    renderTab();
    expect(await screen.findByText(/Enviar mensagem cordial/)).toBeInTheDocument();
    expect(screen.getByText("Sugestões do CRM")).toBeInTheDocument();
    // Consulta filtrada pela OS e apenas abertas.
    expect(api.listSuggestions).toHaveBeenCalledWith({ work_order: 12, open: "1" });
  });

  it("shows an empty state when there is no suggestion", async () => {
    vi.mocked(api.listSuggestions).mockResolvedValue([]);
    renderTab();
    expect(
      await screen.findByText(/Nenhuma sugestão do CRM para esta OS/),
    ).toBeInTheDocument();
  });
});
