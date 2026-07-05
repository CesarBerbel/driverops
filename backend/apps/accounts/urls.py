from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views
from .rbac_views import (
    AuditLogListView,
    PermissionCatalogView,
    RoleListView,
    UserPermissionsView,
    UserViewSet,
)

router = DefaultRouter()
router.register("users", UserViewSet, basename="user")

urlpatterns = [
    path("auth/login/", views.LoginView.as_view(), name="login"),
    path("auth/logout/", views.LogoutView.as_view(), name="logout"),
    path("auth/refresh/", views.RefreshView.as_view(), name="token_refresh"),
    path(
        "auth/password-reset/",
        views.PasswordResetRequestView.as_view(),
        name="password_reset_request",
    ),
    path(
        "auth/password-reset/confirm/",
        views.PasswordResetConfirmView.as_view(),
        name="password_reset_confirm",
    ),
    # Rotas literais ANTES do router para "me"/"change-password"/permissions não
    # caírem no detail (<pk>) do UserViewSet.
    path("users/me/", views.MeView.as_view(), name="me"),
    path(
        "users/change-password/",
        views.ChangePasswordView.as_view(),
        name="change_password",
    ),
    path(
        "users/<int:pk>/permissions/",
        UserPermissionsView.as_view(),
        name="user_permissions",
    ),
    path("roles/", RoleListView.as_view(), name="roles"),
    path(
        "permissions/catalog/",
        PermissionCatalogView.as_view(),
        name="permissions_catalog",
    ),
    path("audit/", AuditLogListView.as_view(), name="audit"),
    path("admin/ping/", views.AdminPingView.as_view(), name="admin_ping"),
] + router.urls
