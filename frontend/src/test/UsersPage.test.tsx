import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UsersPage } from "@/features/users/pages/UsersPage";
import * as usersApi from "@/features/users/api";
import type { ManagedUser, Role } from "@/features/users/types";
import type { Paginated } from "@/lib/pagination";

vi.mock("@/features/users/api");
vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, is_superuser: true, permissions: [] } }),
}));

const ROLES: Role[] = [
  { id: 1, key: "atendente", name: "Atendente", description: "", is_system: true, permission_codes: [] },
  { id: 2, key: "tecnico", name: "Técnico", description: "", is_system: true, permission_codes: [] },
];

function managedUser(overrides: Partial<ManagedUser> = {}): ManagedUser {
  return {
    id: 10,
    email: "ana@example.com",
    full_name: "Ana Souza",
    phone: "",
    whatsapp: "11987654321",
    role: 1,
    role_name: "Atendente",
    role_key: "atendente",
    technical_specialty: "",
    technical_specialty_display: "",
    is_active: true,
    is_superuser: false,
    force_password_change: false,
    notes: "",
    last_login: null,
    date_joined: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

// Envelope paginado do backend a partir de uma lista de usuários.
function paged(items: ManagedUser[]): Paginated<ManagedUser> {
  return { count: items.length, next: null, previous: null, results: items };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("UsersPage", () => {
  beforeEach(() => {
    vi.mocked(usersApi.listRoles).mockResolvedValue(ROLES);
    vi.mocked(usersApi.listUsersPage).mockReset();
  });

  it("lists users with name, email, role and status", async () => {
    vi.mocked(usersApi.listUsersPage).mockResolvedValue(paged([managedUser()]));
    renderPage();
    expect(await screen.findByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
    expect(screen.getByText("Atendente")).toBeInTheDocument();
    expect(screen.getByText("Ativo")).toBeInTheDocument();
  });

  it("opens the create dialog from 'Novo usuário'", async () => {
    vi.mocked(usersApi.listUsersPage).mockResolvedValue(paged([]));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /Novo usuário/ }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("Novo usuário");
  });

  it("queries active users by default", async () => {
    vi.mocked(usersApi.listUsersPage).mockResolvedValue(paged([]));
    renderPage();
    await screen.findByText(/Nenhum usuário encontrado/);
    expect(usersApi.listUsersPage).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ status: "active" }),
    );
  });
});
