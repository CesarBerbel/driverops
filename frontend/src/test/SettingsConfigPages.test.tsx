import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";

vi.mock("@/features/smart-search/api");
vi.mock("@/features/vehicle-portal/api");
import * as ssApi from "@/features/smart-search/api";
import * as portalApi from "@/features/vehicle-portal/api";
import { SmartSearchSettingsPage } from "@/features/smart-search/pages/SmartSearchSettingsPage";
import { CustomerPortalSettingsPage } from "@/features/vehicle-portal/pages/CustomerPortalSettingsPage";

const perms = vi.hoisted(() => ({ codes: new Set<string>(["settings.view", "settings.edit"]) }));
vi.mock("@/features/auth/usePermission", () => ({
  usePermissionCheck: () => (code: string) => perms.codes.has(code),
  useHasPermission: (code: string) => perms.codes.has(code),
}));

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
      <Toaster />
    </QueryClientProvider>,
  );
}

describe("SmartSearchSettingsPage", () => {
  beforeEach(() => {
    perms.codes = new Set(["settings.view", "settings.edit"]);
    vi.mocked(ssApi.getSmartSearchSettings).mockResolvedValue({
      use_ai: true,
      include_internal_notes: true,
      include_financial: true,
      result_limit: 20,
      store_history: true,
      log_queries: true,
      retention_days: 90,
    });
    vi.mocked(ssApi.updateSmartSearchSettings).mockResolvedValue({
      use_ai: false,
      include_internal_notes: true,
      include_financial: true,
      result_limit: 20,
      store_history: true,
      log_queries: true,
      retention_days: 90,
    });
  });

  it("renders the toggles and saves changes", async () => {
    const user = userEvent.setup();
    wrap(<SmartSearchSettingsPage />);
    expect(
      await screen.findByText("Usar IA para interpretar a pergunta"),
    ).toBeInTheDocument();
    await user.click(screen.getByLabelText("Usar IA para interpretar a pergunta"));
    await user.click(screen.getByRole("button", { name: /salvar/i }));
    expect(ssApi.updateSmartSearchSettings).toHaveBeenCalled();
  });

  it("hides the save button for viewers without edit permission", async () => {
    perms.codes = new Set(["settings.view"]);
    wrap(<SmartSearchSettingsPage />);
    await screen.findByText("Usar IA para interpretar a pergunta");
    expect(screen.queryByRole("button", { name: /salvar/i })).not.toBeInTheDocument();
  });
});

describe("CustomerPortalSettingsPage", () => {
  beforeEach(() => {
    perms.codes = new Set(["settings.view", "settings.edit"]);
    vi.mocked(portalApi.getPortalSettings).mockResolvedValue({
      enabled: true,
      require_email: false,
      link_validity_hours: 5,
      single_use_token: false,
      resend_cooldown_seconds: 300,
      show_history: true,
      allow_messages: true,
      allow_pdf_download: true,
      notify_on_access: false,
      notify_on_message: true,
    });
    vi.mocked(portalApi.updatePortalSettings).mockResolvedValue({
      enabled: false,
      require_email: false,
      link_validity_hours: 5,
      single_use_token: false,
      resend_cooldown_seconds: 300,
      show_history: true,
      allow_messages: true,
      allow_pdf_download: true,
      notify_on_access: false,
      notify_on_message: true,
    });
  });

  it("renders the portal toggles and saves changes", async () => {
    const user = userEvent.setup();
    wrap(<CustomerPortalSettingsPage />);
    expect(await screen.findByText("Portal do cliente ativo")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Portal do cliente ativo"));
    await user.click(screen.getByRole("button", { name: /salvar/i }));
    expect(portalApi.updatePortalSettings).toHaveBeenCalled();
  });
});
