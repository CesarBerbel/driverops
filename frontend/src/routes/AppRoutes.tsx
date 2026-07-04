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
import { KanbanPage } from "@/features/kanban/pages/KanbanPage";
import { LandingPage } from "@/features/landing/pages/LandingPage";
import { OrderEditorPage } from "@/features/orders/pages/OrderEditorPage";
import { OrdersPage } from "@/features/orders/pages/OrdersPage";
import { PartsPage } from "@/features/parts/pages/PartsPage";
import { ProfilePage } from "@/features/profile/pages/ProfilePage";
import { ServicePackagesPage } from "@/features/services/pages/ServicePackagesPage";
import { ServicesPage } from "@/features/services/pages/ServicesPage";
import { KanbanSettingsPage } from "@/features/settings/pages/KanbanSettingsPage";
import { OrderSettingsPage } from "@/features/settings/pages/OrderSettingsPage";
import { SettingsPage } from "@/features/settings/pages/SettingsPage";
import { WorkshopProfilePage } from "@/features/settings/pages/WorkshopProfilePage";
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
          <Route path="/kanban" element={<KanbanPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/workshop" element={<WorkshopProfilePage />} />
          <Route path="/settings/orders" element={<OrderSettingsPage />} />
          <Route path="/settings/kanban" element={<KanbanSettingsPage />} />
          <Route path="/settings/categories" element={<ClientCategoriesPage />} />
          <Route path="/settings/categories/parts" element={<PartCategoriesPage />} />
          <Route path="/settings/categories/services" element={<ServiceCategoriesPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/vehicles" element={<VehiclesPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route path="/parts" element={<PartsPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/services/packages" element={<ServicePackagesPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/new" element={<OrderEditorPage />} />
          <Route path="/orders/:id" element={<OrderEditorPage />} />

        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
