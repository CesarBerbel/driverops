import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import * as settingsApi from "@/features/settings/api";
import { PdfBuilderPage } from "@/features/settings/pages/PdfBuilderPage";
import type { PdfLayoutSettings } from "@/features/settings/types";

vi.mock("@/features/settings/api");

const auth = vi.hoisted(() => ({ user: { is_superuser: true } as { is_superuser: boolean } }));
vi.mock("@/features/auth/useAuth", () => ({ useAuth: () => ({ user: auth.user }) }));

function layout(): PdfLayoutSettings {
  return {
    updated_at: "2026-01-01T00:00:00Z",
    accent_color: "#e5e7eb",
    base_font_size: 8.5,
    blocks: [
      { type: "header", options: {} },
      { type: "os_bar", options: { label: "VIA DO CLIENTE", show_number: true, show_emission: true } },
      { type: "customer", options: { fields: ["name", "phone", "email", "document"] } },
    ],
    catalog: [
      { type: "header", label: "Cabeçalho", description: "Logo.", options: [] },
      {
        type: "os_bar",
        label: "Barra da OS",
        description: "Número e via.",
        options: [{ key: "label", kind: "text", label: "Texto central", default: "VIA DO CLIENTE" }],
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
      { type: "text", label: "Texto livre", description: "Parágrafo fixo.", options: [] },
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
    vi.mocked(settingsApi.previewPdfLayout).mockReset();
  });

  it("lists the saved blocks in order", async () => {
    vi.mocked(settingsApi.getPdfLayout).mockResolvedValue(layout());
    renderPage();

    expect(await screen.findByText("Cabeçalho")).toBeInTheDocument();
    expect(screen.getByText("Barra da OS")).toBeInTheDocument();
    expect(screen.getByText(/Blocos do documento \(3\)/)).toBeInTheDocument();
  });

  it("removes a block and saves the remaining layout", async () => {
    vi.mocked(settingsApi.getPdfLayout).mockResolvedValue(layout());
    vi.mocked(settingsApi.updatePdfLayout).mockResolvedValue(layout());
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByLabelText("Remover Cabeçalho"));
    expect(screen.getByText(/Blocos do documento \(2\)/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Salvar alterações/i }));
    await waitFor(() =>
      expect(settingsApi.updatePdfLayout).toHaveBeenCalledWith(
        expect.objectContaining({
          blocks: [
            expect.objectContaining({ type: "os_bar" }),
            expect.objectContaining({ type: "customer" }),
          ],
        }),
      ),
    );
  });

  it("previews with the current (unsaved) layout", async () => {
    vi.mocked(settingsApi.getPdfLayout).mockResolvedValue(layout());
    vi.mocked(settingsApi.previewPdfLayout).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /Pré-visualizar/i }));
    await waitFor(() => expect(settingsApi.previewPdfLayout).toHaveBeenCalled());
  });

  it("shows a lock notice and no save action for non-superusers", async () => {
    auth.user = { is_superuser: false };
    vi.mocked(settingsApi.getPdfLayout).mockResolvedValue(layout());
    renderPage();

    expect(
      await screen.findByText("Apenas superusuários podem alterar o layout do PDF."),
    ).toBeInTheDocument();
    // Espera os dados carregarem: pré-visualizar continua disponível (leitura).
    expect(
      await screen.findByRole("button", { name: /Pré-visualizar/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Salvar alterações/i }),
    ).not.toBeInTheDocument();
  });

  it("restores the default layout from the catalog (drops extra blocks)", async () => {
    const withExtra = layout();
    withExtra.blocks = [...withExtra.blocks, { type: "text", options: {} }];
    vi.mocked(settingsApi.getPdfLayout).mockResolvedValue(withExtra);
    const user = userEvent.setup();
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/Blocos do documento \(4\)/)).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /Restaurar padrão/i }));
    // O padrão do catálogo tem header/os_bar/customer (sem o "text" extra).
    expect(screen.getByText(/Blocos do documento \(3\)/)).toBeInTheDocument();
    const region = screen.getByText(/Blocos do documento/).closest("div")!;
    expect(within(region).queryByText("Texto livre")).not.toBeInTheDocument();
  });
});
