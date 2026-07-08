import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import { NotificationTemplatesManager } from "@/features/notifications/components/NotificationTemplatesManager";
import type {
  NotificationMetadata,
  NotificationTemplate,
} from "@/features/notifications/types";

vi.mock("@/features/notifications/api");
import * as api from "@/features/notifications/api";

// Permissões controláveis por teste.
const perms = vi.hoisted(() => ({
  codes: new Set<string>([
    "notifications.view",
    "notifications.edit",
    "notifications.test",
  ]),
}));
vi.mock("@/features/auth/usePermission", () => ({
  usePermissionCheck: () => (code: string) => perms.codes.has(code),
  useHasPermission: (code: string) => perms.codes.has(code),
}));

function emailTemplate(overrides: Partial<NotificationTemplate> = {}): NotificationTemplate {
  return {
    id: 1,
    event: "order_opened",
    event_display: "Abertura de ordem de serviço",
    channel: "email",
    channel_display: "E-mail",
    context_kind: "order",
    name: "Abertura de OS",
    description: "Enviado quando a OS é aberta.",
    subject: "OS {{ordem_servico.numero}} aberta",
    html_content: "<p>Olá, {{cliente.nome}}!</p>",
    text_content: "Olá, {{cliente.nome}}!",
    is_active: true,
    is_customized: false,
    updated_at: "2026-07-08T10:00:00Z",
    updated_by_name: null,
    ...overrides,
  };
}

const METADATA: NotificationMetadata = {
  events: [
    { key: "order_opened", label: "Abertura de ordem de serviço", description: "", context: "order" },
    { key: "quote_sent", label: "Orçamento enviado", description: "", context: "quote" },
  ],
  channels: [
    { key: "email", label: "E-mail" },
    { key: "whatsapp", label: "WhatsApp" },
    { key: "sms", label: "SMS" },
    { key: "internal", label: "Notificação interna" },
  ],
  variables: [
    {
      key: "cliente",
      label: "Dados do cliente",
      variables: [
        { key: "cliente.nome", label: "Nome", example: "João da Silva" },
        { key: "cliente.primeiro_nome", label: "Primeiro nome", example: "João" },
      ],
    },
    {
      key: "ordem_servico",
      label: "Dados da OS",
      variables: [
        { key: "ordem_servico.numero", label: "Número da OS", example: "0042" },
      ],
    },
  ],
};

function renderManager() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <NotificationTemplatesManager />
      <Toaster />
    </QueryClientProvider>,
  );
}

async function openEditor() {
  renderManager();
  await screen.findByText("Abertura de ordem de serviço");
  await userEvent.click(
    screen.getByRole("button", { name: /Editar template Abertura/ }),
  );
  await screen.findByLabelText("Assunto");
}

beforeEach(() => {
  perms.codes = new Set([
    "notifications.view",
    "notifications.edit",
    "notifications.test",
  ]);
  vi.mocked(api.getNotificationMetadata).mockResolvedValue(METADATA);
  vi.mocked(api.listNotificationTemplates).mockResolvedValue([
    emailTemplate(),
    emailTemplate({
      id: 2,
      event: "quote_sent",
      event_display: "Orçamento enviado",
      channel: "whatsapp",
      channel_display: "WhatsApp",
      name: "Orçamento enviado",
    }),
  ]);
  vi.mocked(api.updateNotificationTemplate).mockImplementation(async (_id, payload) =>
    emailTemplate(payload as Partial<NotificationTemplate>),
  );
  vi.mocked(api.restoreNotificationTemplate).mockResolvedValue(emailTemplate());
  vi.mocked(api.bulkSetTemplateStatus).mockResolvedValue({ updated: 2, is_active: false });
  vi.mocked(api.testSendNotificationTemplate).mockResolvedValue({
    status: "sent",
    recipient: "teste@example.com",
    error: "",
    link: "",
    errors: [],
  });
  vi.mocked(api.getNotificationTemplateHistory).mockResolvedValue([]);
  vi.mocked(api.previewNotificationTemplate).mockResolvedValue({
    subject: "",
    html: "",
    text: "",
    errors: [],
  });
});

describe("NotificationTemplatesManager", () => {
  it("lists the seeded templates", async () => {
    renderManager();
    expect(await screen.findByText("Abertura de ordem de serviço")).toBeInTheDocument();
    expect(screen.getAllByText("Orçamento enviado").length).toBeGreaterThan(0);
    // Canal exibido como badge.
    expect(screen.getAllByText("E-mail").length).toBeGreaterThan(0);
  });

  it("opens a template and saves an edited subject", async () => {
    await openEditor();
    const subject = screen.getByLabelText("Assunto");
    fireEvent.change(subject, { target: { value: "Novo assunto {{cliente.nome}}" } });
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(api.updateNotificationTemplate).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ subject: "Novo assunto {{cliente.nome}}" }),
      ),
    );
  });

  it("blocks saving when an unknown variable is used", async () => {
    await openEditor();
    const html = screen.getByLabelText("Conteúdo HTML");
    fireEvent.change(html, {
      target: { value: "<p>{{cliente.inexistente}}</p>" },
    });
    expect(
      await screen.findByText(/Variáveis inexistentes/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  });

  it("inserts a variable at the cursor into the focused field", async () => {
    await openEditor();
    const subject = screen.getByLabelText("Assunto") as HTMLInputElement;
    subject.focus();
    fireEvent.change(subject, { target: { value: "" } });
    await userEvent.click(screen.getByRole("button", { name: "Inserir Número da OS" }));
    await waitFor(() =>
      expect((screen.getByLabelText("Assunto") as HTMLInputElement).value).toContain(
        "{{ordem_servico.numero}}",
      ),
    );
  });

  it("restores the system default", async () => {
    await openEditor();
    await userEvent.click(screen.getByRole("button", { name: /Restaurar padrão/ }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Restaurar" }));
    await waitFor(() =>
      expect(api.restoreNotificationTemplate).toHaveBeenCalledWith(1),
    );
  });

  it("sends a test message", async () => {
    await openEditor();
    fireEvent.change(screen.getByLabelText("Destinatário do teste"), {
      target: { value: "teste@example.com" },
    });
    await userEvent.click(screen.getByRole("button", { name: /Enviar teste/ }));
    await waitFor(() =>
      expect(api.testSendNotificationTemplate).toHaveBeenCalledWith(1, "teste@example.com"),
    );
  });

  it("selects all and deactivates in bulk", async () => {
    renderManager();
    await screen.findByText("Abertura de ordem de serviço");

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Selecionar todos os templates" }),
    );
    expect(screen.getByText(/2 template\(s\) selecionado\(s\)/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Inativar/ }));
    await waitFor(() =>
      expect(api.bulkSetTemplateStatus).toHaveBeenCalledWith([1, 2], false),
    );
  });

  it("selects a single row and activates it", async () => {
    vi.mocked(api.bulkSetTemplateStatus).mockResolvedValue({ updated: 1, is_active: true });
    renderManager();
    await screen.findByText("Abertura de ordem de serviço");

    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "Selecionar Abertura de ordem de serviço E-mail",
      }),
    );
    expect(screen.getByText(/1 template\(s\) selecionado\(s\)/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Ativar/ }));
    await waitFor(() =>
      expect(api.bulkSetTemplateStatus).toHaveBeenCalledWith([1], true),
    );
  });

  it("hides bulk selection without the edit permission", async () => {
    perms.codes = new Set(["notifications.view"]);
    renderManager();
    await screen.findByText("Abertura de ordem de serviço");
    expect(
      screen.queryByRole("checkbox", { name: "Selecionar todos os templates" }),
    ).not.toBeInTheDocument();
  });

  it("hides edit affordances without the edit permission", async () => {
    perms.codes = new Set(["notifications.view"]);
    await openEditor();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
    expect(
      screen.getByText(/não tem permissão para editar templates/),
    ).toBeInTheDocument();
  });
});
