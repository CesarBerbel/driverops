from rest_framework.routers import DefaultRouter

from .views import ExpenseViewSet, PaymentViewSet

router = DefaultRouter()
router.register("payments", PaymentViewSet, basename="payment")
router.register("expenses", ExpenseViewSet, basename="expense")

urlpatterns = router.urls
