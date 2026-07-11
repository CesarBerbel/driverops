from django.urls import path

from .views import (
    RecentSearchView,
    SavedSearchDetailView,
    SavedSearchView,
    SearchSuggestionsView,
    SmartSearchSettingsView,
    SmartSearchView,
)

urlpatterns = [
    path("search/smart/", SmartSearchView.as_view(), name="smart-search"),
    path("search/recent/", RecentSearchView.as_view(), name="smart-search-recent"),
    path("search/saved/", SavedSearchView.as_view(), name="smart-search-saved"),
    path(
        "search/saved/<int:pk>/",
        SavedSearchDetailView.as_view(),
        name="smart-search-saved-detail",
    ),
    path(
        "search/suggestions/",
        SearchSuggestionsView.as_view(),
        name="smart-search-suggestions",
    ),
    path(
        "settings/smart-search/",
        SmartSearchSettingsView.as_view(),
        name="smart-search-settings",
    ),
]
