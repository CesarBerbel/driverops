import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import * as settingsApi from "@/features/settings/api";
import { OrderSettingsPage } from "@/features/settings/pages/OrderSettingsPage";
import type { OrderSettings } from "@/features/settings/types";

vi.mock("@/features/settings/api");

const auth = vi.hoisted(() => ({ user: { is_superuser: true } as { is_superuser: boolean } }));
vi.mock("@/features/auth/useAuth", () => ({ useAuth: () => ({ user: auth.user }) }));

function settings(overrides: Partial<OrderSettings> = {}): OrderSettings {
  return {
    default_delivery_days: 7,
    default_payment_due_days: 0,
    warranty_terms: "Garantia padrão",
    quote_terms: "Orçamento padrão",
    service_authorization_terms: "Autorização padrão",
    customer_acknowledgment_terms: "Ciência padrão",
    default_os_notes: "",
    pdf_footer_text: "Rodapé",
    print_instructions: "",
    general_conditions: "",
    pdf_client_copy_label: "VIA DO CLIENTE",
    pdf_signature_label: "Assinatura do cliente:",
    notify_customer_by_email: true,
    notify_statuses: ["ready", "finished"],
    notify_on_creation: false,
    notify_on_payment: false,
    require_diagnosis_before_approval: false,
    require_approved_quote_for_execution: false,
    require_checkin_before_execution: false,
    require_payment_to_finish: false,
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <OrderSettingsPage />
      </MemoryRouter>
      <Toaster />
    </QueryClientProvider>,
  );
}

describe("OrderSettingsPage", () => {
  beforeEach(() => {
    auth.user = { is_superuser: true };
    vi.mocked(settingsApi.getOrderSettings).mockReset();
    vi.mocked(settingsApi.updateOrderSettings).mockReset();
  });

  it("loads the default deadline and term fields", async () => {
    vi.mocked(settingsApi.getOrderSettings).mockResolvedValue(settings());
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "Configurações da OS" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText("Prazo padrão de entrega")).toHaveValue("7"),
    );
    expect(screen.getByLabelText("Termo de orçamento")).toHaveValue("Orçamento padrão");
    // Os textos do PDF da OS (garantia etc.) migraram para o Construtor de PDF.
    expect(screen.queryByLabelText("Termo de garantia")).not.toBeInTheDocument();
  });

  it("saves the deadline as a number for a superuser", async () => {
    vi.mocked(settingsApi.getOrderSettings).mockResolvedValue(settings());
    vi.mocked(settingsApi.updateOrderSettings).mockResolvedValue(settings({ default_delivery_days: 10 }));
    const user = userEvent.setup();
    renderPage();
    const input = await screen.findByLabelText("Prazo padrão de entrega");
    await user.clear(input);
    await user.type(input, "10");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() =>
      expect(settingsApi.updateOrderSettings).toHaveBeenCalledWith(
        expect.objectContaining({ default_delivery_days: 10 }),
        expect.anything(),
      ),
    );
  });

  it("rejects an empty deadline", async () => {
    vi.mocked(settingsApi.getOrderSettings).mockResolvedValue(settings());
    const user = userEvent.setup();
    renderPage();
    const input = await screen.findByLabelText("Prazo padrão de entrega");
    await user.clear(input);
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(
      await screen.findByText("Informe um número de dias válido (não negativo)."),
    ).toBeInTheDocument();
    expect(settingsApi.updateOrderSettings).not.toHaveBeenCalled();
  });

  it("shows a lock notice and no save action for non-superusers", async () => {
    auth.user = { is_superuser: false };
    vi.mocked(settingsApi.getOrderSettings).mockResolvedValue(settings());
    renderPage();
    expect(
      await screen.findByText("Apenas superusuários podem editar as configurações da OS."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Salvar alterações" }),
    ).not.toBeInTheDocument();
  });
});
