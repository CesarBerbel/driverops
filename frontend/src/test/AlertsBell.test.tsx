import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationBell } from "@/features/alerts/components/NotificationBell";
import type { NotificationItem } from "@/features/alerts/types";

vi.mock("@/features/alerts/api", () => ({
  getUnreadCount: vi.fn(),
  listNotifications: vi.fn(),
  markAllRead: vi.fn(),
  markRead: vi.fn(),
}));
import * as api from "@/features/alerts/api";

function item(over: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: 1,
    notif_type: "site_lead_created",
    notif_type_display: "Novo pedido do site",
    module: "leads",
    module_display: "Site/Pedidos",
    title: "Novo pedido vindo do site",
    message: "Maria deixou contato.",
    detail: "",
    priority: "important",
    priority_display: "Importante",
    status: "unread",
    status_display: "Não lida",
    is_read: false,
    related_type: "SiteLead",
    related_id: 5,
    url: "/leads/5",
    action_label: "Abrir pedido",
    data: {},
    origin: "automatic",
    audience_role_name: null,
    created_at: new Date().toISOString(),
    read_at: null,
    ...over,
  };
}

function renderBell() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(api.getUnreadCount).mockResolvedValue(3);
  vi.mocked(api.listNotifications).mockResolvedValue([item()]);
  vi.mocked(api.markRead).mockResolvedValue(item({ status: "read" }));
  vi.mocked(api.markAllRead).mockResolvedValue({ updated: 3 });
});

describe("NotificationBell", () => {
  it("shows the unread badge count", async () => {
    renderBell();
    expect(await screen.findByText("3")).toBeInTheDocument();
  });

  it("opens the dropdown and lists recent notifications", async () => {
    renderBell();
    await screen.findByText("3");
    await userEvent.click(screen.getByRole("button", { name: /Notificações/ }));
    expect(await screen.findByText("Novo pedido vindo do site")).toBeInTheDocument();
    expect(api.listNotifications).toHaveBeenCalledWith({ limit: 8 });
  });

  it("marks all as read from the dropdown header", async () => {
    renderBell();
    await screen.findByText("3");
    await userEvent.click(screen.getByRole("button", { name: /Notificações/ }));
    await screen.findByText("Novo pedido vindo do site");
    await userEvent.click(screen.getByRole("button", { name: /Marcar todas/ }));
    await waitFor(() => expect(api.markAllRead).toHaveBeenCalled());
  });
});
