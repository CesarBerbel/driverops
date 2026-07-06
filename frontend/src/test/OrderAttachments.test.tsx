import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as ordersApi from "@/features/orders/api";
import { OrderAttachments } from "@/features/orders/components/OrderAttachments";
import type { OrderAttachment } from "@/features/orders/types";

vi.mock("@/features/orders/api", async (importOriginal) => {
  const actual = await importOriginal<typeof ordersApi>();
  return {
    ...actual,
    listAttachments: vi.fn(),
    uploadAttachment: vi.fn(),
    updateAttachment: vi.fn(),
    deleteAttachment: vi.fn(),
  };
});

const auth = vi.hoisted(() => ({
  user: { is_superuser: false, permissions: [] as string[] },
}));
vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({ user: auth.user }),
}));

function attachment(overrides: Partial<OrderAttachment> = {}): OrderAttachment {
  return {
    id: 1,
    file: "/media/orders/1/foto.png",
    original_name: "foto.png",
    content_type: "image/png",
    size: 2048,
    category: "other",
    category_display: "Outros",
    caption: "",
    uploaded_by_name: "Admin",
    is_image: true,
    created_at: "2026-07-05T12:00:00Z",
    ...overrides,
  };
}

function renderAttachments() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <OrderAttachments orderId={1} />
    </QueryClientProvider>,
  );
}

describe("OrderAttachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user = { is_superuser: false, permissions: ["orders.view", "orders.edit"] };
    vi.mocked(ordersApi.listAttachments).mockResolvedValue([attachment()]);
    vi.mocked(ordersApi.uploadAttachment).mockResolvedValue(attachment({ id: 2 }));
  });

  it("lists existing attachments", async () => {
    renderAttachments();
    expect(await screen.findByText("foto.png")).toBeInTheDocument();
  });

  it("uploads a selected file with the chosen category and caption", async () => {
    const user = userEvent.setup();
    renderAttachments();
    await screen.findByText("foto.png");
    const input = screen.getByLabelText("Selecionar arquivo");
    const file = new File(["data"], "nota.pdf", { type: "application/pdf" });
    await user.upload(input, file);
    await waitFor(() => expect(ordersApi.uploadAttachment).toHaveBeenCalledTimes(1));
    expect(ordersApi.uploadAttachment).toHaveBeenCalledWith(1, file, {
      category: "other",
      caption: "",
    });
  });

  it("hides the upload controls and per-item actions for a view-only user", async () => {
    auth.user = { is_superuser: false, permissions: ["orders.view"] };
    renderAttachments();
    await screen.findByText("foto.png");
    expect(screen.queryByRole("button", { name: /Anexar/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Remover/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Editar/ })).toBeNull();
  });
});
