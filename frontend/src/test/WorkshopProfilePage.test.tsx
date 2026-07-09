import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import * as settingsApi from "@/features/settings/api";
import { WorkshopProfilePage } from "@/features/settings/pages/WorkshopProfilePage";
import type { WorkshopProfile } from "@/features/settings/types";

vi.mock("@/features/settings/api");

const auth = vi.hoisted(() => ({ user: { is_superuser: true } as { is_superuser: boolean } }));
vi.mock("@/features/auth/useAuth", () => ({ useAuth: () => ({ user: auth.user }) }));

function profile(overrides: Partial<WorkshopProfile> = {}): WorkshopProfile {
  return {
    trade_name: "",
    legal_name: "",
    cnpj: "",
    state_registration: "",
    responsible: "",
    email: "",
    phone: "",
    whatsapp: "",
    website: "",
    logo: null,
    zip_code: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    country: "Brasil",
    business_hours: "",
    notes: "",
    testimonials: [],
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <WorkshopProfilePage />
      </MemoryRouter>
      <Toaster />
    </QueryClientProvider>,
  );
}

describe("WorkshopProfilePage", () => {
  beforeEach(() => {
    auth.user = { is_superuser: true };
    vi.mocked(settingsApi.getWorkshopProfile).mockReset();
    vi.mocked(settingsApi.updateWorkshopProfile).mockReset();
    vi.mocked(settingsApi.uploadWorkshopLogo).mockReset();
    vi.mocked(settingsApi.deleteWorkshopLogo).mockReset();
  });

  it("loads and shows the existing profile data", async () => {
    vi.mocked(settingsApi.getWorkshopProfile).mockResolvedValue(
      profile({ trade_name: "Oficina Central", cnpj: "11222333000181" }),
    );
    renderPage();
    expect(await screen.findByRole("heading", { name: "Dados da Oficina" })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText("Nome fantasia")).toHaveValue("Oficina Central"),
    );
    // CNPJ is shown masked from stored digits.
    expect(screen.getByLabelText("CNPJ")).toHaveValue("11.222.333/0001-81");
  });

  it("requires a nome fantasia before saving", async () => {
    vi.mocked(settingsApi.getWorkshopProfile).mockResolvedValue(profile());
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText("Nome fantasia");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(await screen.findByText("O nome fantasia é obrigatório.")).toBeInTheDocument();
    expect(settingsApi.updateWorkshopProfile).not.toHaveBeenCalled();
  });

  it("saves the profile for a superuser", async () => {
    vi.mocked(settingsApi.getWorkshopProfile).mockResolvedValue(profile());
    vi.mocked(settingsApi.updateWorkshopProfile).mockResolvedValue(
      profile({ trade_name: "Nova Oficina" }),
    );
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText("Nome fantasia"), "Nova Oficina");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() =>
      expect(settingsApi.updateWorkshopProfile).toHaveBeenCalledWith(
        expect.objectContaining({ trade_name: "Nova Oficina" }),
        expect.anything(),
      ),
    );
  });

  it("uploads a logo file", async () => {
    vi.mocked(settingsApi.getWorkshopProfile).mockResolvedValue(profile({ trade_name: "X" }));
    vi.mocked(settingsApi.uploadWorkshopLogo).mockResolvedValue(
      profile({ trade_name: "X", logo: "http://x/media/workshop/logos/logo.png" }),
    );
    const user = userEvent.setup();
    renderPage();
    const input = await screen.findByLabelText("Selecionar logotipo");
    const file = new File(["binary"], "logo.png", { type: "image/png" });
    await user.upload(input, file);
    await waitFor(() =>
      expect(settingsApi.uploadWorkshopLogo).toHaveBeenCalledWith(file, expect.anything()),
    );
  });

  it("removes an existing logo", async () => {
    vi.mocked(settingsApi.getWorkshopProfile).mockResolvedValue(
      profile({ trade_name: "X", logo: "http://x/media/workshop/logos/logo.png" }),
    );
    vi.mocked(settingsApi.deleteWorkshopLogo).mockResolvedValue(
      profile({ trade_name: "X", logo: null }),
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Remover" }));
    await waitFor(() => expect(settingsApi.deleteWorkshopLogo).toHaveBeenCalled());
  });

  it("hides the logo controls for non-superusers", async () => {
    auth.user = { is_superuser: false };
    vi.mocked(settingsApi.getWorkshopProfile).mockResolvedValue(
      profile({ trade_name: "X", logo: "http://x/media/workshop/logos/logo.png" }),
    );
    renderPage();
    // The logo preview still renders, but no upload/remove controls.
    expect(await screen.findByAltText("Logotipo da oficina")).toBeInTheDocument();
    expect(screen.queryByLabelText("Selecionar logotipo")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remover" })).not.toBeInTheDocument();
  });

  it("hides the save action and shows a lock notice for non-superusers", async () => {
    auth.user = { is_superuser: false };
    vi.mocked(settingsApi.getWorkshopProfile).mockResolvedValue(profile({ trade_name: "X" }));
    renderPage();
    expect(
      await screen.findByText("Apenas superusuários podem editar os dados da oficina."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Salvar alterações" }),
    ).not.toBeInTheDocument();
  });
});
