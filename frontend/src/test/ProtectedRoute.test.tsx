import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ProtectedRoute } from "@/features/auth/ProtectedRoute";

const useAuthMock = vi.fn();

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

function renderProtectedRoute() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route path="/login" element={<div>Tela de login</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<div>Conteúdo protegido</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  it("shows a loading state while auth is resolving", () => {
    useAuthMock.mockReturnValue({ isAuthenticated: false, isLoading: true });
    const { container } = renderProtectedRoute();
    // EngineLoader: região com role=status e a animação dos pistões.
    expect(container.querySelector('[role="status"]')).toBeInTheDocument();
    expect(container.querySelector(".engine-piston")).toBeInTheDocument();
  });

  it("redirects to /login when not authenticated", () => {
    useAuthMock.mockReturnValue({ isAuthenticated: false, isLoading: false });
    renderProtectedRoute();
    expect(screen.getByText("Tela de login")).toBeInTheDocument();
  });

  it("renders the protected content when authenticated", () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true, isLoading: false });
    renderProtectedRoute();
    expect(screen.getByText("Conteúdo protegido")).toBeInTheDocument();
  });
});
