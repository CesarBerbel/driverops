import { type ComponentType, lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { PageLoader } from "@/components/loading";
import { AppShell } from "@/components/layout/AppShell";
import { ForcePasswordChangeGate } from "@/features/auth/ForcePasswordChangeGate";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { PublicOnlyRoute } from "@/features/auth/PublicOnlyRoute";
import { RequirePermission } from "@/features/auth/RequirePermission";

// Páginas carregadas sob demanda (code-split por rota): cada tela vira um chunk
// separado, então o bundle inicial não carrega todas as telas de uma vez.
const named = <T extends Record<string, unknown>, K extends keyof T>(
  factory: () => Promise<T>,
  key: K,
) => lazy(() => factory().then((m) => ({ default: m[key] as ComponentType })));

const LandingPage = named(() => import("@/features/landing/pages/LandingPage"), "LandingPage");
const LoginPage = named(() => import("@/features/auth/pages/LoginPage"), "LoginPage");
const ForgotPasswordPage = named(() => import("@/features/auth/pages/ForgotPasswordPage"), "ForgotPasswordPage");
const ResetPasswordPage = named(() => import("@/features/auth/pages/ResetPasswordPage"), "ResetPasswordPage");
const PublicQuoteApprovalPage = named(() => import("@/features/quotes/pages/PublicQuoteApprovalPage"), "PublicQuoteApprovalPage");
const VehicleAccessRequestPage = named(() => import("@/features/vehicle-portal/pages/VehicleAccessRequestPage"), "VehicleAccessRequestPage");
const VehiclePortalPage = named(() => import("@/features/vehicle-portal/pages/VehiclePortalPage"), "VehiclePortalPage");
const DashboardPage = named(() => import("@/features/dashboard/pages/DashboardPage"), "DashboardPage");
const KanbanPage = named(() => import("@/features/kanban/pages/KanbanPage"), "KanbanPage");
const ProfilePage = named(() => import("@/features/profile/pages/ProfilePage"), "ProfilePage");
const SettingsPage = named(() => import("@/features/settings/pages/SettingsPage"), "SettingsPage");
const WorkshopProfilePage = named(() => import("@/features/settings/pages/WorkshopProfilePage"), "WorkshopProfilePage");
const OrderSettingsPage = named(() => import("@/features/settings/pages/OrderSettingsPage"), "OrderSettingsPage");
const KanbanSettingsPage = named(() => import("@/features/settings/pages/KanbanSettingsPage"), "KanbanSettingsPage");
const NotificationTemplatesPage = named(() => import("@/features/notifications/pages/NotificationTemplatesPage"), "NotificationTemplatesPage");
const AiSettingsPage = named(() => import("@/features/ai/pages/AiSettingsPage"), "AiSettingsPage");
const LeadInboxPage = named(() => import("@/features/leads/pages/LeadInboxPage"), "LeadInboxPage");
const LeadDetailPage = named(() => import("@/features/leads/pages/LeadDetailPage"), "LeadDetailPage");
const LeadSettingsPage = named(() => import("@/features/leads/pages/LeadSettingsPage"), "LeadSettingsPage");
const NotificationsPage = named(() => import("@/features/alerts/pages/NotificationsPage"), "NotificationsPage");
const NotificationSettingsPage = named(() => import("@/features/alerts/pages/NotificationSettingsPage"), "NotificationSettingsPage");
const CrmPage = named(() => import("@/features/crm/pages/CrmPage"), "CrmPage");
const CrmTasksPage = named(() => import("@/features/crm/pages/CrmTasksPage"), "CrmTasksPage");
const CrmSettingsPage = named(() => import("@/features/crm/pages/CrmSettingsPage"), "CrmSettingsPage");
const ClientCategoriesPage = named(() => import("@/features/categories/pages/ClientCategoriesPage"), "ClientCategoriesPage");
const PartCategoriesPage = named(() => import("@/features/categories/pages/PartCategoriesPage"), "PartCategoriesPage");
const ServiceCategoriesPage = named(() => import("@/features/categories/pages/ServiceCategoriesPage"), "ServiceCategoriesPage");
const CustomersPage = named(() => import("@/features/customers/pages/CustomersPage"), "CustomersPage");
const Customer360Page = named(() => import("@/features/customer360/pages/Customer360Page"), "Customer360Page");
const VehiclesPage = named(() => import("@/features/vehicles/pages/VehiclesPage"), "VehiclesPage");
const SuppliersPage = named(() => import("@/features/suppliers/pages/SuppliersPage"), "SuppliersPage");
const PartsPage = named(() => import("@/features/parts/pages/PartsPage"), "PartsPage");
const ServicesPage = named(() => import("@/features/services/pages/ServicesPage"), "ServicesPage");
const ServicePackagesPage = named(() => import("@/features/services/pages/ServicePackagesPage"), "ServicePackagesPage");
const OrdersPage = named(() => import("@/features/orders/pages/OrdersPage"), "OrdersPage");
const OrderEditorPage = named(() => import("@/features/orders/pages/OrderEditorPage"), "OrderEditorPage");
const FinancialPage = named(() => import("@/features/financial/pages/FinancialPage"), "FinancialPage");
const ExpensesPage = named(() => import("@/features/financial/pages/ExpensesPage"), "ExpensesPage");
const ReportsPage = named(() => import("@/features/financial/pages/ReportsPage"), "ReportsPage");
const UsersPage = named(() => import("@/features/users/pages/UsersPage"), "UsersPage");
const PermissionsMatrixPage = named(() => import("@/features/users/pages/PermissionsMatrixPage"), "PermissionsMatrixPage");
const AuditPage = named(() => import("@/features/users/pages/AuditPage"), "AuditPage");

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader label="Carregando..." />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        {/* Página pública de aprovação do orçamento (acesso só pelo token, sem login). */}
        <Route path="/orcamento/:token" element={<PublicQuoteApprovalPage />} />

        {/* Portal público de consulta do veículo (link mágico por e-mail). */}
        <Route path="/veiculo" element={<VehicleAccessRequestPage />} />
        <Route path="/veiculo/:token" element={<VehiclePortalPage />} />

        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<ForcePasswordChangeGate />}>
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/kanban" element={<KanbanPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/workshop" element={<WorkshopProfilePage />} />
              <Route path="/settings/orders" element={<OrderSettingsPage />} />
              <Route path="/settings/kanban" element={<KanbanSettingsPage />} />
              <Route element={<RequirePermission code="notifications.view" />}>
                <Route
                  path="/settings/notification-templates"
                  element={<NotificationTemplatesPage />}
                />
              </Route>
              <Route element={<RequirePermission code="ai.view" />}>
                <Route path="/settings/ai" element={<AiSettingsPage />} />
              </Route>
              <Route element={<RequirePermission code="leads.view" />}>
                <Route path="/leads" element={<LeadInboxPage />} />
                <Route path="/leads/:id" element={<LeadDetailPage />} />
                <Route path="/settings/leads" element={<LeadSettingsPage />} />
              </Route>
              <Route element={<RequirePermission code="alerts.view" />}>
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/settings/notifications" element={<NotificationSettingsPage />} />
              </Route>
              <Route element={<RequirePermission code="crm.view" />}>
                <Route path="/crm" element={<CrmPage />} />
                <Route path="/crm/tasks" element={<CrmTasksPage />} />
                <Route path="/settings/crm" element={<CrmSettingsPage />} />
              </Route>
              <Route path="/settings/categories" element={<ClientCategoriesPage />} />
              <Route path="/settings/categories/parts" element={<PartCategoriesPage />} />
              <Route path="/settings/categories/services" element={<ServiceCategoriesPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route element={<RequirePermission code="customers.view" />}>
                <Route path="/customers/:id/360" element={<Customer360Page />} />
              </Route>
              <Route path="/vehicles" element={<VehiclesPage />} />
              <Route path="/suppliers" element={<SuppliersPage />} />
              <Route path="/parts" element={<PartsPage />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/services/packages" element={<ServicePackagesPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/orders/new" element={<OrderEditorPage />} />
              <Route path="/orders/:id" element={<OrderEditorPage />} />

              {/* Financeiro / contas a receber (protegido por permissão). */}
              <Route element={<RequirePermission code="financial.view" />}>
                <Route path="/financial" element={<FinancialPage />} />
                <Route path="/financial/expenses" element={<ExpensesPage />} />
              </Route>
              <Route element={<RequirePermission code="financial.reports" />}>
                <Route path="/financial/reports" element={<ReportsPage />} />
              </Route>

              {/* Usuários / permissões / auditoria (protegidos por permissão). */}
              <Route element={<RequirePermission code="users.manage" />}>
                <Route path="/users" element={<UsersPage />} />
              </Route>
              <Route element={<RequirePermission code="permissions.manage" />}>
                <Route path="/users/:id/permissions" element={<PermissionsMatrixPage />} />
              </Route>
              <Route element={<RequirePermission code="audit.view" />}>
                <Route path="/audit" element={<AuditPage />} />
              </Route>
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
