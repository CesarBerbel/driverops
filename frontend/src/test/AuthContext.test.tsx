import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/features/auth/AuthContext";
import * as authApi from "@/features/auth/api";
import { useAuth } from "@/features/auth/useAuth";
import type { User } from "@/features/auth/types";

vi.mock("@/features/auth/api");

const USER: User = {
  id: 1,
  email: "user@example.com",
  full_name: "Jane Doe",
  is_staff: false,
  is_superuser: false,
  date_joined: "2026-01-01T00:00:00Z",
  role: null,
  role_name: null,
  technical_specialty: "",
  technical_specialty_display: "",
  force_password_change: false,
  permissions: [],
};

// Minimal axios-error shape (axios.isAxiosError only checks `isAxiosError`).
function axiosError(status: number) {
  return { isAxiosError: true, response: { status }, message: "err" };
}

function Consumer() {
  const { isAuthenticated, isLoading, refetch } = useAuth();
  return (
    <div>
      <span data-testid="state">
        {isLoading ? "loading" : isAuthenticated ? "auth" : "anon"}
      </span>
      <button onClick={() => refetch()}>refetch</button>
    </div>
  );
}

function renderProvider() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("AuthProvider session resilience", () => {
  beforeEach(() => {
    vi.mocked(authApi.fetchMe).mockReset();
  });

  it("keeps the session when /me fails transiently (non-401)", async () => {
    vi.mocked(authApi.fetchMe)
      .mockResolvedValueOnce(USER)
      .mockRejectedValueOnce(axiosError(500));
    const user = userEvent.setup();
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("auth"));
    await user.click(screen.getByRole("button", { name: "refetch" }));

    // The 500 must not log the user out -- the previous session is kept.
    await waitFor(() => expect(authApi.fetchMe).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("state")).toHaveTextContent("auth");
  });

  it("logs out when /me returns a genuine 401", async () => {
    vi.mocked(authApi.fetchMe)
      .mockResolvedValueOnce(USER)
      .mockRejectedValueOnce(axiosError(401));
    const user = userEvent.setup();
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("auth"));
    await user.click(screen.getByRole("button", { name: "refetch" }));

    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("anon"));
  });
});
