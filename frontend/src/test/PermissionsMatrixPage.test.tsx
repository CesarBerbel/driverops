import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PermissionsMatrixPage } from "@/features/users/pages/PermissionsMatrixPage";
import * as usersApi from "@/features/users/api";
import type { UserPermissionsResponse } from "@/features/users/types";

vi.mock("@/features/users/api");

const RESPONSE: UserPermissionsResponse = {
  user: {
    id: 5,
    email: "at@example.com",
    full_name: "Ana",
    role_key: "atendente",
    role_name: "Atendente",
    is_superuser: false,
  },
  modules: [
    {
      module: "customers",
      label: "Clientes",
      permissions: [
        {
          codename: "customers.view",
          action: "view",
          label: "Visualizar",
          is_critical: false,
          inherited: true,
          granted: false,
          revoked: false,
          effective: true,
        },
        {
          codename: "customers.delete",
          action: "delete",
          label: "Excluir",
          is_critical: false,
          inherited: false,
          granted: false,
          revoked: false,
          effective: false,
        },
      ],
    },
  ],
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/users/5/permissions"]}>
        <Routes>
          <Route path="/users/:id/permissions" element={<PermissionsMatrixPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PermissionsMatrixPage", () => {
  beforeEach(() => {
    vi.mocked(usersApi.getUserPermissions).mockResolvedValue(RESPONSE);
    vi.mocked(usersApi.setUserPermissions).mockResolvedValue(RESPONSE);
  });

  it("shows inherited vs concedida/removida and the role", async () => {
    renderPage();
    expect(await screen.findByText("Clientes")).toBeInTheDocument();
    // Herdada (inherited + effective) aparece marcada com a tag "Herdada".
    expect(screen.getByRole("checkbox", { name: /Visualizar/ })).toBeChecked();
    expect(screen.getByText("Herdada")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Excluir/ })).not.toBeChecked();
  });

  it("computes granted/revoked from toggles and saves", async () => {
    const user = userEvent.setup();
    renderPage();

    // Remove a herdada (customers.view -> revoked) e concede a extra (customers.delete -> granted).
    await user.click(await screen.findByRole("checkbox", { name: /Visualizar/ }));
    await user.click(screen.getByRole("checkbox", { name: /Excluir/ }));
    await user.click(screen.getByRole("button", { name: /Salvar alterações/ }));

    await waitFor(() =>
      expect(usersApi.setUserPermissions).toHaveBeenCalledWith(5, {
        granted: ["customers.delete"],
        revoked: ["customers.view"],
      }),
    );
  });
});
