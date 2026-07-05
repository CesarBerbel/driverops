from django.contrib import admin

from .models import Quote, QuoteItem


class QuoteItemInline(admin.TabularInline):
    model = QuoteItem
    extra = 0


@admin.register(Quote)
class QuoteAdmin(admin.ModelAdmin):
    list_display = [
        "number",
        "version",
        "work_order",
        "status",
        "approval_channel",
        "created_at",
    ]
    list_filter = ["status", "approval_channel"]
    search_fields = ["number", "work_order__number", "client_name"]
    inlines = [QuoteItemInline]
    readonly_fields = ["public_token", "number"]
