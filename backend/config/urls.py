from django.conf import settings
from django.conf.urls.static import static
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
    path("api/", include("apps.suppliers.urls")),
    path("api/", include("apps.services.urls")),
    path("api/", include("apps.orders.urls")),
    path("api/", include("apps.workshop.urls")),
    path("api/", include("apps.quotes.urls")),
    path("api/", include("apps.financial.urls")),
    path("api/", include("apps.notifications.urls")),
    path("api/", include("apps.ai_assistant.urls")),
    path("api/", include("apps.leads.urls")),
    path("api/", include("apps.alerts.urls")),
    path("api/", include("apps.checkin.urls")),
    path("api/", include("apps.crm.urls")),
]

# Serve uploaded media in development (no-op when DEBUG is False).
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
