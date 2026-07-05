import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ForcePasswordChangeGate } from "@/features/auth/ForcePasswordChangeGate";

const auth = vi.hoisted(() => ({
  user: { force_password_change: false } as { force_password_change: boolean },
}));
vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({ user: auth.user, refetch: vi.fn() }),
}));

function renderGate() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route element={<ForcePasswordChangeGate />}>
            <Route path="/dashboard" element={<div>APP CONTENT</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ForcePasswordChangeGate", () => {
  it("renders the app when no forced change is required", () => {
    auth.user = { force_password_change: false };
    renderGate();
    expect(screen.getByText("APP CONTENT")).toBeInTheDocument();
    expect(screen.queryByText(/Troque sua senha/)).not.toBeInTheDocument();
  });

  it("blocks the app and shows the change-password form when forced", () => {
    auth.user = { force_password_change: true };
    renderGate();
    expect(screen.getByText(/Troque sua senha para continuar/)).toBeInTheDocument();
    expect(screen.queryByText("APP CONTENT")).not.toBeInTheDocument();
  });
});
