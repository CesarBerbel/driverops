from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    PublicQuoteApproveView,
    PublicQuoteDetailView,
    PublicQuoteRejectView,
    QuoteViewSet,
)

router = DefaultRouter()
router.register("quotes", QuoteViewSet, basename="quote")

urlpatterns = router.urls + [
    path(
        "public/quotes/<str:token>/",
        PublicQuoteDetailView.as_view(),
        name="public-quote-detail",
    ),
    path(
        "public/quotes/<str:token>/approve/",
        PublicQuoteApproveView.as_view(),
        name="public-quote-approve",
    ),
    path(
        "public/quotes/<str:token>/reject/",
        PublicQuoteRejectView.as_view(),
        name="public-quote-reject",
    ),
]
