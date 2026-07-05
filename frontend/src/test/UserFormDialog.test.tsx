import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import { UserFormDialog } from "@/features/users/components/UserFormDialog";
import * as usersApi from "@/features/users/api";
import type { Role } from "@/features/users/types";

vi.mock("@/features/users/api");

const ROLES: Role[] = [
  { id: 1, key: "atendente", name: "Atendente", description: "", is_system: true, permission_codes: [] },
  { id: 2, key: "tecnico", name: "Técnico", description: "", is_system: true, permission_codes: [] },
];

function renderDialog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <UserFormDialog open onOpenChange={() => {}} user={null} />
      <Toaster />
    </QueryClientProvider>,
  );
}

describe("UserFormDialog", () => {
  beforeEach(() => {
    vi.mocked(usersApi.listRoles).mockResolvedValue(ROLES);
    vi.mocked(usersApi.createUser).mockReset();
  });

  it("shows the technical specialty field only for the Técnico role", async () => {
    const user = userEvent.setup();
    renderDialog();
    await screen.findByLabelText("Perfil");
    expect(screen.queryByLabelText("Especialidade técnica")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Perfil"));
    await user.click(await screen.findByRole("option", { name: "Técnico" }));

    expect(await screen.findByLabelText("Especialidade técnica")).toBeInTheDocument();
  });

  it("creates a user with role and initial password", async () => {
    vi.mocked(usersApi.createUser).mockResolvedValue({} as never);
    const user = userEvent.setup();
    renderDialog();

    await user.type(await screen.findByLabelText("Nome completo"), "Ana Souza");
    await user.type(screen.getByLabelText("E-mail (login)"), "ana@example.com");
    await user.click(screen.getByLabelText("Perfil"));
    await user.click(await screen.findByRole("option", { name: "Atendente" }));
    await user.type(screen.getByLabelText("Senha inicial"), "StrongPass123");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(usersApi.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          full_name: "Ana Souza",
          email: "ana@example.com",
          role: 1,
          password: "StrongPass123",
        }),
      ),
    );
  });
});
