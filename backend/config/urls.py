from django.contrib import admin
from django.urls import include, path, re_path

from apps.core.media import ProtectedMediaView

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
    # Mídia (uploads) servida de forma PRIVADA -- exige autenticação, exceto o
    # branding público (logo). Nunca exposta diretamente pelo nginx.
    re_path(r"^media/(?P<path>.+)$", ProtectedMediaView.as_view(), name="media"),
]
