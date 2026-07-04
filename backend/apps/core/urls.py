from django.urls import path

from . import views

urlpatterns = [
    path("health/", views.health, name="health"),
    path("dashboard/stats/", views.dashboard_stats, name="dashboard-stats"),
]
