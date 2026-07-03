from django.urls import path

from . import views

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
    path("users/me/", views.MeView.as_view(), name="me"),
    path(
        "users/change-password/",
        views.ChangePasswordView.as_view(),
        name="change_password",
    ),
    path("admin/ping/", views.AdminPingView.as_view(), name="admin_ping"),
]
