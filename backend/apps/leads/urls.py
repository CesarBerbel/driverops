from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    LeadSettingsView,
    LeadViewSet,
    PublicLeadConfigView,
    PublicLeadCreateView,
)

router = DefaultRouter()
router.register("leads", LeadViewSet, basename="lead")

urlpatterns = [
    path(
        "public/lead-config/", PublicLeadConfigView.as_view(), name="public-lead-config"
    ),
    path("public/leads/", PublicLeadCreateView.as_view(), name="public-lead-create"),
    path("lead-settings/", LeadSettingsView.as_view(), name="lead-settings"),
    *router.urls,
]
