import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import { NotificationsPage } from "@/features/alerts/pages/NotificationsPage";
import type { NotificationItem } from "@/features/alerts/types";

vi.mock("@/features/alerts/api", () => ({
  listNotifications: vi.fn(),
  markRead: vi.fn(),
  markUnread: vi.fn(),
  markAllRead: vi.fn(),
  markReadBulk: vi.fn(),
  archiveNotification: vi.fn(),
}));
import * as api from "@/features/alerts/api";

function item(over: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: 1,
    notif_type: "os_overdue",
    notif_type_display: "OS atrasada",
    module: "orders",
    module_display: "Ordem de Serviço",
    title: "OS #12 atrasada",
    message: "A OS #12 está atrasada.",
    detail: "",
    priority: "urgent",
    priority_display: "Urgente",
    status: "unread",
    status_display: "Não lida",
    is_read: false,
    related_type: "WorkOrder",
    related_id: 12,
    url: "/orders/12",
    action_label: "Abrir OS",
    data: {},
    origin: "automatic",
    audience_role_name: null,
    created_at: new Date().toISOString(),
    read_at: null,
    ...over,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>
      <Toaster />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(api.listNotifications).mockResolvedValue([item()]);
  vi.mocked(api.markRead).mockResolvedValue(item({ status: "read" }));
  vi.mocked(api.markAllRead).mockResolvedValue({ updated: 1 });
});

describe("Central de Notificações", () => {
  it("lists notifications with priority and module", async () => {
    renderPage();
    expect(await screen.findByText("OS #12 atrasada")).toBeInTheDocument();
    expect(screen.getByText("Urgente")).toBeInTheDocument();
    expect(screen.getByText("Hoje")).toBeInTheDocument();
  });

  it("marks a single notification as read", async () => {
    renderPage();
    await screen.findByText("OS #12 atrasada");
    await userEvent.click(screen.getByRole("button", { name: "Marcar como lida" }));
    await waitFor(() => expect(api.markRead).toHaveBeenCalledWith(1, expect.anything()));
  });

  it("filters by the 'Não lidas' tab", async () => {
    renderPage();
    await screen.findByText("OS #12 atrasada");
    await userEvent.click(screen.getByRole("button", { name: "Não lidas" }));
    await waitFor(() =>
      expect(api.listNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ status: "unread" }),
      ),
    );
  });

  it("shows the empty state when there are no notifications", async () => {
    vi.mocked(api.listNotifications).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText(/Nenhuma notificação no momento/)).toBeInTheDocument();
  });
});
