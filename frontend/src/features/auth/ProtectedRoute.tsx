import { Navigate, Outlet, useLocation } from "react-router-dom";

import { EngineLoader } from "@/components/loading";

import { useAuth } from "./useAuth";

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3">
        <EngineLoader size="xl" />
        <p className="text-sm text-muted-foreground">Preparando a oficina...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
