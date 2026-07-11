import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({ user: getUser(), logout: vi.fn() }),
}));

import { MobileBottomNav } from "@/components/layout/mobile/MobileBottomNav";
import { MobileMoreMenu } from "@/components/layout/mobile/MobileMoreMenu";

function renderWith(ui: ReactNode, initial = "/dashboard") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initial]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => getUser.mockReset());

describe("MobileBottomNav", () => {
  it("shows Início, Nova OS and Mais when the user can create orders", () => {
    getUser.mockReturnValue({ id: 1, is_superuser: false, permissions: ["orders.create"] });
    renderWith(<MobileBottomNav />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nova OS" })).toHaveAttribute(
      "href",
      "/orders/new",
    );
    expect(screen.getByRole("button", { name: "Mais módulos" })).toBeInTheDocument();
    // Exatamente 3 acoes principais -- sem poluicao.
    expect(screen.getByRole("navigation", { name: "Navegação principal" })).toBeInTheDocument();
  });

  it("hides the Nova OS button when the user cannot create orders", () => {
    getUser.mockReturnValue({ id: 1, is_superuser: false, permissions: [] });
    renderWith(<MobileBottomNav />);
    expect(screen.queryByRole("link", { name: "Nova OS" })).not.toBeInTheDocument();
    // Início e Mais continuam.
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mais módulos" })).toBeInTheDocument();
  });

  it("opens the More menu (with modules) and never shows an Orçamentos item", async () => {
    getUser.mockReturnValue({ id: 1, is_superuser: true, permissions: [] });
    const user = userEvent.setup();
    renderWith(<MobileBottomNav />);
    await user.click(screen.getByRole("button", { name: "Mais módulos" }));
    expect(await screen.findByText("Ordens de Serviço")).toBeInTheDocument();
    expect(screen.getByText("Clientes")).toBeInTheDocument();
    // Orçamento e parte da OS: NUNCA um item de menu separado.
    expect(screen.queryByText(/or[çc]amento/i)).not.toBeInTheDocument();
  });
});

describe("MobileMoreMenu", () => {
  it("shows every group for a superuser, including Administração, but no Orçamentos", () => {
    getUser.mockReturnValue({ id: 1, is_superuser: true, permissions: [] });
    renderWith(<MobileMoreMenu open onOpenChange={vi.fn()} />);
    expect(screen.getByText("Operação")).toBeInTheDocument();
    expect(screen.getByText("Cadastros")).toBeInTheDocument();
    expect(screen.getByText("Gestão")).toBeInTheDocument();
    expect(screen.getByText("Administração")).toBeInTheDocument();
    expect(screen.getByText("Usuários")).toBeInTheDocument();
    expect(screen.getByText("Financeiro")).toBeInTheDocument();
    expect(screen.queryByText(/or[çc]amento/i)).not.toBeInTheDocument();
  });

  it("hides modules and empty groups the user has no permission for", () => {
    // Sem permissões especiais: Cadastros/Operação (itens sem gate) aparecem;
    // Gestão (todos os itens exigem permissão) e Administração (só Configurações
    // sem gate) filtram o que não pode.
    getUser.mockReturnValue({ id: 1, is_superuser: false, permissions: [] });
    renderWith(<MobileMoreMenu open onOpenChange={vi.fn()} />);
    expect(screen.getByText("Clientes")).toBeInTheDocument();
    expect(screen.getByText("Ordens de Serviço")).toBeInTheDocument();
    // Sem financial.view -> Financeiro some; sem itens, o grupo Gestão some.
    expect(screen.queryByText("Financeiro")).not.toBeInTheDocument();
    expect(screen.queryByText("Gestão")).not.toBeInTheDocument();
    // Sem users.manage/audit.view -> só "Configurações" resta em Administração.
    expect(screen.queryByText("Usuários")).not.toBeInTheDocument();
    expect(screen.getByText("Configurações")).toBeInTheDocument();
  });

  it("filters a single module by its permission (Financeiro needs financial.view)", () => {
    getUser.mockReturnValue({
      id: 1,
      is_superuser: false,
      permissions: ["financial.view"],
    });
    renderWith(<MobileMoreMenu open onOpenChange={vi.fn()} />);
    expect(screen.getByText("Gestão")).toBeInTheDocument();
    expect(screen.getByText("Financeiro")).toBeInTheDocument();
    // financial.reports não concedido -> Relatórios some.
    expect(screen.queryByText("Relatórios")).not.toBeInTheDocument();
  });
});
