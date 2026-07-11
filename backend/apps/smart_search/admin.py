from django.contrib import admin

from .models import RecentSearch, SavedSearch, SearchLog, SmartSearchSettings


@admin.register(SmartSearchSettings)
class SmartSearchSettingsAdmin(admin.ModelAdmin):
    list_display = [
        "__str__",
        "use_ai",
        "include_internal_notes",
        "include_financial",
        "updated_at",
    ]


@admin.register(SearchLog)
class SearchLogAdmin(admin.ModelAdmin):
    list_display = [
        "query",
        "user",
        "result_count",
        "used_ai",
        "duration_ms",
        "created_at",
    ]
    list_filter = ["used_ai", "created_at"]
    search_fields = ["query"]
    readonly_fields = [f.name for f in SearchLog._meta.fields]


@admin.register(SavedSearch)
class SavedSearchAdmin(admin.ModelAdmin):
    list_display = ["label", "user", "query", "created_at"]


@admin.register(RecentSearch)
class RecentSearchAdmin(admin.ModelAdmin):
    list_display = ["query", "user", "updated_at"]
