from rest_framework.routers import DefaultRouter

from .views import PartViewSet

router = DefaultRouter()
router.register("parts", PartViewSet, basename="part")

urlpatterns = router.urls
