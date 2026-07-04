from django.urls import path

from .views import OrderSettingsView, WorkshopProfileView

urlpatterns = [
    path("workshop-profile/", WorkshopProfileView.as_view(), name="workshop-profile"),
    path("order-settings/", OrderSettingsView.as_view(), name="order-settings"),
]
