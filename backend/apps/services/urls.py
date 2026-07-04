from rest_framework.routers import DefaultRouter

from .views import ServicePackageViewSet, ServiceViewSet

router = DefaultRouter()
router.register("services", ServiceViewSet, basename="service")
router.register("service-packages", ServicePackageViewSet, basename="service-package")

urlpatterns = router.urls
