from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import VehicleBrandListView, VehicleViewSet

router = DefaultRouter()
router.register("vehicles", VehicleViewSet, basename="vehicle")

urlpatterns = router.urls + [
    path("vehicle-brands/", VehicleBrandListView.as_view(), name="vehicle-brands"),
]
