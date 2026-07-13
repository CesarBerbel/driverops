import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import * as settingsApi from "@/features/settings/api";
import { PdfBuilderPage } from "@/features/settings/pages/PdfBuilderPage";
import type { OrderSettings, PdfLayoutSettings } from "@/features/settings/types";

vi.mock("@/features/settings/api");

const auth = vi.hoisted(() => ({ user: { is_superuser: true } as { is_superuser: boolean } }));
vi.mock("@/features/auth/useAuth", () => ({ useAuth: () => ({ user: auth.user }) }));

function orderSettings(): OrderSettings {
  return {
    default_delivery_days: 7,
    default_payment_due_days: 0,
    warranty_terms: "Garantia padrão",
    quote_terms: "Orçamento padrão",
    service_authorization_terms: "Autorização padrão",
    customer_acknowledgment_terms: "Ciência padrão",
    default_os_notes: "",
    pdf_footer_text: "Rodapé padrão",
    print_instructions: "",
    general_conditions: "",
    pdf_client_copy_label: "VIA DO CLIENTE",
    pdf_signature_label: "Assinatura do cliente:",
    notify_customer_by_email: true,
    notify_statuses: [],
    notify_on_creation: false,
    notify_on_payment: false,
    require_diagnosis_before_approval: false,
    require_approved_quote_for_execution: false,
    require_checkin_before_execution: false,
    require_payment_to_finish: false,
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function layout(): PdfLayoutSettings {
  return {
    updated_at: "2026-01-01T00:00:00Z",
    accent_color: "#e5e7eb",
    base_font_size: 8.5,
    blocks: [
      { type: "header", options: {} },
      { type: "os_bar", options: { show_number: true, show_emission: true } },
      { type: "customer", options: { fields: ["name", "phone", "email", "document"] } },
      { type: "terms", options: { include: ["authorization", "warranty", "general", "acknowledgment"] } },
    ],
    catalog: [
      { type: "header", label: "Cabeçalho", description: "Logo.", options: [] },
      {
        type: "os_bar",
        label: "Barra da OS",
        description: "Número e via.",
        options: [
          { key: "show_number", kind: "bool", label: "Mostrar número da OS", default: true },
        ],
      },
      {
        type: "customer",
        label: "Cliente",
        description: "Ficha do cliente.",
        options: [
          {
            key: "fields",
            kind: "multi",
            label: "Campos",
            default: ["name", "phone", "email", "document"],
            choices: [
              ["name", "Nome"],
              ["phone", "Telefone"],
              ["email", "E-mail"],
              ["document", "CPF/CNPJ"],
            ],
          },
        ],
      },
      {
        type: "terms",
        label: "Termos",
        description: "Termos do PDF.",
        options: [
          {
            key: "include",
            kind: "multi",
            label: "Termos incluídos",
            default: ["authorization", "warranty", "general", "acknowledgment"],
            choices: [
              ["authorization", "Autorização de serviço"],
              ["warranty", "Garantia"],
              ["general", "Condições gerais"],
              ["acknowledgment", "Ciência do cliente"],
            ],
          },
        ],
      },
      { type: "spacer", label: "Espaçador", description: "Espaço vertical.", options: [] },
    ],
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PdfBuilderPage />
      </MemoryRouter>
      <Toaster />
    </QueryClientProvider>,
  );
}

describe("PdfBuilderPage", () => {
  beforeEach(() => {
    auth.user = { is_superuser: true };
    vi.mocked(settingsApi.getPdfLayout).mockReset();
    vi.mocked(settingsApi.updatePdfLayout).mockReset();
    vi.mocked(settingsApi.fetchPdfLayoutPreviewUrl).mockReset();
    vi.mocked(settingsApi.getOrderSettings).mockReset();
    vi.mocked(settingsApi.updateOrderSettings).mockReset();
    vi.mocked(settingsApi.getOrderSettings).mockResolvedValue(orderSettings());
    vi.mocked(settingsApi.updateOrderSettings).mockResolvedValue(orderSettings());
  });

  it("lists the saved sections in order", async () => {
    vi.mocked(settingsApi.getPdfLayout).mockResolvedValue(layout());
    renderPage();

    expect(await screen.findByText("Cabeçalho")).toBeInTheDocument();
    expect(screen.getByText("Barra da OS")).toBeInTheDocument();
    expect(screen.getByText(/Seções do documento \(4\)/)).toBeInTheDocument();
  });

  it("removes a section and saves the remaining layout", async () => {
    vi.mocked(settingsApi.getPdfLayout).mockResolvedValue(layout());
    vi.mocked(settingsApi.updatePdfLayout).mockResolvedValue(layout());
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByLabelText("Remover Cabeçalho"));
    expect(screen.getByText(/Seções do documento \(3\)/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Salvar alterações/i }));
    await waitFor(() =>
      expect(settingsApi.updatePdfLayout).toHaveBeenCalledWith(
        expect.objectContaining({
          blocks: [
            expect.objectContaining({ type: "os_bar" }),
            expect.objectContaining({ type: "customer" }),
            expect.objectContaining({ type: "terms" }),
          ],
        }),
      ),
    );
  });

  it("edits a term inside the Termos section and saves it to order settings", async () => {
    vi.mocked(settingsApi.getPdfLayout).mockResolvedValue(layout());
    vi.mocked(settingsApi.updatePdfLayout).mockResolvedValue(layout());
    const user = userEvent.setup();
    renderPage();

    // O texto do termo é editado no próprio bloco "Termos".
    const garantia = await screen.findByLabelText("Texto de Garantia");
    expect(garantia).toHaveValue("Garantia padrão");
    await user.clear(garantia);
    await user.type(garantia, "Nova garantia");

    await user.click(screen.getByRole("button", { name: /Salvar alterações/i }));
    await waitFor(() =>
      expect(settingsApi.updateOrderSettings).toHaveBeenCalledWith(
        expect.objectContaining({ warranty_terms: "Nova garantia" }),
      ),
    );
  });

  it("refreshes the inline preview with the current (unsaved) layout", async () => {
    vi.mocked(settingsApi.getPdfLayout).mockResolvedValue(layout());
    vi.mocked(settingsApi.fetchPdfLayoutPreviewUrl).mockResolvedValue("blob:mock-pdf");
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /Atualizar/i }));
    await waitFor(() => expect(settingsApi.fetchPdfLayoutPreviewUrl).toHaveBeenCalled());
    // O PDF renderizado aparece embutido num iframe.
    await waitFor(() =>
      expect(screen.getByTitle("Prévia do PDF da OS")).toHaveAttribute("src", "blob:mock-pdf"),
    );
  });

  it("shows a lock notice and no save action for non-superusers", async () => {
    auth.user = { is_superuser: false };
    vi.mocked(settingsApi.getPdfLayout).mockResolvedValue(layout());
    renderPage();

    expect(
      await screen.findByText("Apenas superusuários podem alterar o PDF da OS."),
    ).toBeInTheDocument();
    // Espera os dados carregarem: atualizar a prévia continua disponível (leitura).
    expect(
      await screen.findByRole("button", { name: /Atualizar/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Salvar alterações/i }),
    ).not.toBeInTheDocument();
  });

  it("restores the default layout from the catalog (drops extra sections)", async () => {
    const withExtra = layout();
    withExtra.blocks = [...withExtra.blocks, { type: "spacer", options: {} }];
    vi.mocked(settingsApi.getPdfLayout).mockResolvedValue(withExtra);
    const user = userEvent.setup();
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/Seções do documento \(5\)/)).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /Restaurar padrão/i }));
    // O padrão do catálogo tem header/os_bar/customer/terms (sem o "spacer").
    expect(screen.getByText(/Seções do documento \(4\)/)).toBeInTheDocument();
    const region = screen.getByText(/Seções do documento/).closest("div")!;
    expect(within(region).queryByText("Espaçador")).not.toBeInTheDocument();
  });
});
