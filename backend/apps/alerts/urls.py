from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    NotificationPreferenceView,
    NotificationRuleView,
    NotificationViewSet,
)

router = DefaultRouter()
router.register("notifications", NotificationViewSet, basename="notification")

urlpatterns = router.urls + [
    path("notification-rules/", NotificationRuleView.as_view(), name="notification-rules"),
    path(
        "notification-preferences/",
        NotificationPreferenceView.as_view(),
        name="notification-preferences",
    ),
]
