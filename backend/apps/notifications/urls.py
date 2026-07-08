from rest_framework.routers import DefaultRouter

from .views import NotificationTemplateViewSet

router = DefaultRouter()
router.register(
    "notification-templates",
    NotificationTemplateViewSet,
    basename="notification-template",
)

urlpatterns = router.urls
