import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { PublicOnlyRoute } from "@/features/auth/PublicOnlyRoute";
import { ForgotPasswordPage } from "@/features/auth/pages/ForgotPasswordPage";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { ResetPasswordPage } from "@/features/auth/pages/ResetPasswordPage";
import { ClientCategoriesPage } from "@/features/categories/pages/ClientCategoriesPage";
import { PartCategoriesPage } from "@/features/categories/pages/PartCategoriesPage";
import { ServiceCategoriesPage } from "@/features/categories/pages/ServiceCategoriesPage";
import { CustomersPage } from "@/features/customers/pages/CustomersPage";
import { DashboardPage } from "@/features/dashboard/pages/DashboardPage";
import { LandingPage } from "@/features/landing/pages/LandingPage";
import { PartsPage } from "@/features/parts/pages/PartsPage";
import { ProfilePage } from "@/features/profile/pages/ProfilePage";
import { ServicePackagesPage } from "@/features/services/pages/ServicePackagesPage";
import { ServicesPage } from "@/features/services/pages/ServicesPage";
import { SettingsPage } from "@/features/settings/pages/SettingsPage";
import { SuppliersPage } from "@/features/suppliers/pages/SuppliersPage";
import { VehiclesPage } from "@/features/vehicles/pages/VehiclesPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/categories" element={<ClientCategoriesPage />} />
          <Route path="/settings/categories/parts" element={<PartCategoriesPage />} />
          <Route path="/settings/categories/services" element={<ServiceCategoriesPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/vehicles" element={<VehiclesPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route path="/parts" element={<PartsPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/services/packages" element={<ServicePackagesPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
