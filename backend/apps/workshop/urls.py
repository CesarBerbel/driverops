from django.urls import path

from .public_views import PublicLandingView
from .views import (
    KanbanSettingsView,
    OrderSettingsView,
    WorkshopLogoView,
    WorkshopProfileView,
)

urlpatterns = [
    path("public/landing/", PublicLandingView.as_view(), name="public-landing"),
    path("workshop-profile/", WorkshopProfileView.as_view(), name="workshop-profile"),
    path(
        "workshop-profile/logo/",
        WorkshopLogoView.as_view(),
        name="workshop-logo",
    ),
    path("order-settings/", OrderSettingsView.as_view(), name="order-settings"),
    path("kanban-settings/", KanbanSettingsView.as_view(), name="kanban-settings"),
]
