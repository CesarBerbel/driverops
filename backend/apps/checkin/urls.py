from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    BelongingDeleteView,
    CheckInPhotoDeleteView,
    CheckInViewSet,
    DamagePhotoDeleteView,
    DamageViewSet,
    WorkOrderCheckInView,
)

router = DefaultRouter()
router.register("check-ins", CheckInViewSet, basename="check-in")
router.register("check-in-damages", DamageViewSet, basename="check-in-damage")

urlpatterns = router.urls + [
    path(
        "work-orders/<int:pk>/check-in/",
        WorkOrderCheckInView.as_view(),
        name="work-order-check-in",
    ),
    path(
        "check-in-photos/<int:pk>/",
        CheckInPhotoDeleteView.as_view(),
        name="check-in-photo-delete",
    ),
    path(
        "check-in-damage-photos/<int:pk>/",
        DamagePhotoDeleteView.as_view(),
        name="check-in-damage-photo-delete",
    ),
    path(
        "check-in-belongings/<int:pk>/",
        BelongingDeleteView.as_view(),
        name="check-in-belonging-delete",
    ),
]
