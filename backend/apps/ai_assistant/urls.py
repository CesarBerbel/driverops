from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AIFieldInstructionViewSet,
    AIGenerateView,
    AIMetadataView,
    AISettingsView,
    AITestView,
    AIUsageLogViewSet,
)

router = DefaultRouter()
router.register(
    "ai/field-instructions", AIFieldInstructionViewSet, basename="ai-field-instruction"
)
router.register("ai/logs", AIUsageLogViewSet, basename="ai-usage-log")

urlpatterns = [
    path("ai/settings/", AISettingsView.as_view(), name="ai-settings"),
    path("ai/metadata/", AIMetadataView.as_view(), name="ai-metadata"),
    path("ai/generate/", AIGenerateView.as_view(), name="ai-generate"),
    path("ai/test/", AITestView.as_view(), name="ai-test"),
    *router.urls,
]
