from django.urls import path

from . import views

urlpatterns = [
    # `request/` antes do <token> genérico (senão "request" cairia como token).
    path(
        "public/vehicle-access/request/",
        views.VehicleAccessRequestView.as_view(),
        name="vehicle_access_request",
    ),
    path(
        "public/vehicle-access/<str:token>/message/",
        views.VehicleAccessMessageView.as_view(),
        name="vehicle_access_message",
    ),
    path(
        "public/vehicle-access/<str:token>/order-pdf/<int:order_id>/",
        views.VehicleAccessOrderPdfView.as_view(),
        name="vehicle_access_order_pdf",
    ),
    path(
        "public/vehicle-access/<str:token>/",
        views.VehicleAccessDetailView.as_view(),
        name="vehicle_access_detail",
    ),
]
