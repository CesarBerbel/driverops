import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import { CrmTasksPage } from "@/features/crm/pages/CrmTasksPage";
import type { CrmTask } from "@/features/crm/types";
import type { Paginated } from "@/lib/pagination";

vi.mock("@/features/crm/api", () => ({
  listTasks: vi.fn(),
  listTasksPage: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  getTasksPendingCount: vi.fn(),
}));
import * as api from "@/features/crm/api";

const perms = vi.hoisted(() => ({
  codes: new Set<string>(["crm.view", "crm.assign_task"]),
}));
vi.mock("@/features/auth/usePermission", () => ({
  usePermissionCheck: () => (code: string) => perms.codes.has(code),
  useHasPermission: (code: string) => perms.codes.has(code),
}));

function task(over: Partial<CrmTask> = {}): CrmTask {
  return {
    id: 1,
    title: "Ligar para a Maria",
    customer: 5,
    customer_name: "Maria Silva",
    customer_phone: "11988887777",
    customer_whatsapp: "11988887777",
    vehicle: 2,
    vehicle_plate: "ABC1D23",
    work_order: 12,
    work_order_number: 12,
    quote: null,
    quote_number: null,
    suggestion: 3,
    assigned_to: null,
    assigned_to_name: null,
    due_date: "2026-07-20",
    priority: "high",
    priority_display: "Alta",
    status: "open",
    status_display: "Aberta",
    notes: "",
    created_at: new Date().toISOString(),
    ...over,
  };
}

// Envelope paginado do backend a partir de uma lista de tarefas.
function paged(items: CrmTask[]): Paginated<CrmTask> {
  return { count: items.length, next: null, previous: null, results: items };
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <CrmTasksPage />
      </MemoryRouter>
      <Toaster />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  perms.codes = new Set(["crm.view", "crm.assign_task"]);
  vi.mocked(api.listTasksPage).mockResolvedValue(paged([task()]));
  vi.mocked(api.updateTask).mockResolvedValue(task({ status: "done" }));
  vi.mocked(api.deleteTask).mockResolvedValue(undefined);
});

describe("CRM — Tarefas", () => {
  it("blocks users without permission", async () => {
    perms.codes = new Set();
    renderPage();
    expect(
      await screen.findByText("Você não tem permissão para ver o CRM inteligente."),
    ).toBeInTheDocument();
  });

  it("lists tasks with title, customer and priority", async () => {
    renderPage();
    expect(await screen.findByText("Ligar para a Maria")).toBeInTheDocument();
    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByText("Alta")).toBeInTheDocument();
    expect(screen.getByText("OS #12")).toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    vi.mocked(api.listTasksPage).mockResolvedValue(paged([]));
    renderPage();
    expect(await screen.findByText("Nenhuma tarefa por aqui.")).toBeInTheDocument();
  });

  it("completes a task", async () => {
    renderPage();
    await screen.findByText("Ligar para a Maria");
    await userEvent.click(screen.getByRole("button", { name: "Concluir" }));
    await waitFor(() =>
      expect(api.updateTask).toHaveBeenCalledWith(1, { status: "done" }),
    );
  });

  it("edits a task through the dialog", async () => {
    renderPage();
    await screen.findByText("Ligar para a Maria");
    await userEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(await screen.findByText("Editar tarefa")).toBeInTheDocument();
    const title = screen.getByLabelText("Título");
    await userEvent.clear(title);
    await userEvent.type(title, "Ligar amanhã de manhã");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(api.updateTask).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ title: "Ligar amanhã de manhã" }),
      ),
    );
  });

  it("hides mutating actions without crm.assign_task", async () => {
    perms.codes = new Set(["crm.view"]);
    renderPage();
    await screen.findByText("Ligar para a Maria");
    expect(screen.queryByRole("button", { name: "Concluir" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nova tarefa" })).not.toBeInTheDocument();
  });
});
