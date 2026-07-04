import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import * as settingsApi from "@/features/settings/api";
import { KanbanSettingsPage } from "@/features/settings/pages/KanbanSettingsPage";
import type { KanbanSettings } from "@/features/settings/types";

vi.mock("@/features/settings/api");

const auth = vi.hoisted(() => ({ user: { is_superuser: true } as { is_superuser: boolean } }));
vi.mock("@/features/auth/useAuth", () => ({ useAuth: () => ({ user: auth.user }) }));

function settings(): KanbanSettings {
  return {
    updated_at: "2026-01-01T00:00:00Z",
    columns: [
      { status: "open", visible: true },
      { status: "diagnosing", visible: true },
      { status: "awaiting_approval", visible: true },
      { status: "approved", visible: true },
      { status: "in_progress", visible: true },
      { status: "awaiting_parts", visible: true },
      { status: "testing", visible: true },
      { status: "ready", visible: true },
      { status: "finished", visible: false },
      { status: "canceled", visible: false },
    ],
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <KanbanSettingsPage />
      </MemoryRouter>
      <Toaster />
    </QueryClientProvider>,
  );
}

describe("KanbanSettingsPage", () => {
  beforeEach(() => {
    auth.user = { is_superuser: true };
    vi.mocked(settingsApi.getKanbanSettings).mockReset();
    vi.mocked(settingsApi.updateKanbanSettings).mockReset();
  });

  it("lists all columns with finished/canceled unchecked by default", async () => {
    vi.mocked(settingsApi.getKanbanSettings).mockResolvedValue(settings());
    renderPage();

    await waitFor(() =>
      expect(screen.getByLabelText("Finalizada")).not.toBeChecked(),
    );
    expect(screen.getByLabelText("Cancelada")).not.toBeChecked();
    expect(screen.getByLabelText("Aberta")).toBeChecked();
  });

  it("saves the edited column visibility for a superuser", async () => {
    vi.mocked(settingsApi.getKanbanSettings).mockResolvedValue(settings());
    vi.mocked(settingsApi.updateKanbanSettings).mockResolvedValue(settings());
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByLabelText("Finalizada"));
    await user.click(screen.getByRole("button", { name: /Salvar alterações/i }));

    // TanStack v5 calls mutationFn as (variables, context) -> match both.
    await waitFor(() =>
      expect(settingsApi.updateKanbanSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          columns: expect.arrayContaining([
            expect.objectContaining({ status: "finished", visible: true }),
          ]),
        }),
        expect.anything(),
      ),
    );
  });

  it("restores the default configuration", async () => {
    vi.mocked(settingsApi.getKanbanSettings).mockResolvedValue(settings());
    vi.mocked(settingsApi.updateKanbanSettings).mockResolvedValue(settings());
    const user = userEvent.setup();
    renderPage();

    // Turn a column off, then restore defaults -> it should be back on.
    await user.click(await screen.findByLabelText("Aberta"));
    expect(screen.getByLabelText("Aberta")).not.toBeChecked();
    await user.click(screen.getByRole("button", { name: /Restaurar padrão/i }));
    expect(screen.getByLabelText("Aberta")).toBeChecked();
    expect(screen.getByLabelText("Finalizada")).not.toBeChecked();
  });

  it("shows a lock notice and no save action for non-superusers", async () => {
    auth.user = { is_superuser: false };
    vi.mocked(settingsApi.getKanbanSettings).mockResolvedValue(settings());
    renderPage();

    expect(
      await screen.findByText("Apenas superusuários podem alterar as configurações do Kanban."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Salvar alterações/i }),
    ).not.toBeInTheDocument();
  });
});
