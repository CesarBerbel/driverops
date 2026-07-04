from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("apps.core.urls")),
    path("api/", include("apps.accounts.urls")),
    path("api/", include("apps.categories.urls")),
    path("api/", include("apps.customers.urls")),
    path("api/", include("apps.vehicles.urls")),
    path("api/", include("apps.parts.urls")),
]
