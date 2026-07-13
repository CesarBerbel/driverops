from django.urls import path

from .public_views import PublicLandingView
from .views import (
    KanbanSettingsView,
    OrderSettingsView,
    PdfLayoutPreviewView,
    PdfLayoutSettingsView,
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
    path("pdf-layout/", PdfLayoutSettingsView.as_view(), name="pdf-layout"),
    path(
        "pdf-layout/preview/",
        PdfLayoutPreviewView.as_view(),
        name="pdf-layout-preview",
    ),
]
