from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import CampaignViewSet, CrmSettingsView, SuggestionViewSet, TaskViewSet

router = DefaultRouter()
router.register("crm/suggestions", SuggestionViewSet, basename="crm-suggestion")
router.register("crm/tasks", TaskViewSet, basename="crm-task")
router.register("crm/campaigns", CampaignViewSet, basename="crm-campaign")

urlpatterns = router.urls + [
    path("crm/settings/", CrmSettingsView.as_view(), name="crm-settings"),
]
