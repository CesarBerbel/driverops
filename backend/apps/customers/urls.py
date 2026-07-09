from django.urls import path
from rest_framework.routers import DefaultRouter

from .c360 import (
    Customer360FinancialView,
    Customer360OrdersView,
    Customer360QuotesView,
    Customer360TimelineView,
    Customer360View,
    CustomerInteractionsView,
)
from .views import CustomerViewSet

router = DefaultRouter()
router.register("customers", CustomerViewSet, basename="customer")

urlpatterns = router.urls + [
    path("customers/<int:pk>/360/", Customer360View.as_view(), name="customer-360"),
    path(
        "customers/<int:pk>/work-orders/",
        Customer360OrdersView.as_view(),
        name="customer-360-orders",
    ),
    path(
        "customers/<int:pk>/quotes/",
        Customer360QuotesView.as_view(),
        name="customer-360-quotes",
    ),
    path(
        "customers/<int:pk>/interactions/",
        CustomerInteractionsView.as_view(),
        name="customer-360-interactions",
    ),
    path(
        "customers/<int:pk>/financial-summary/",
        Customer360FinancialView.as_view(),
        name="customer-360-financial",
    ),
    path(
        "customers/<int:pk>/timeline/",
        Customer360TimelineView.as_view(),
        name="customer-360-timeline",
    ),
]
