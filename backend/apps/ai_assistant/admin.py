from django.contrib import admin

from .models import AIFieldInstruction, AISettings, AIUsageLog


@admin.register(AISettings)
class AISettingsAdmin(admin.ModelAdmin):
    list_display = ["provider", "model", "is_active", "updated_at"]


@admin.register(AIFieldInstruction)
class AIFieldInstructionAdmin(admin.ModelAdmin):
    list_display = ["field_key", "name", "is_active", "is_customized", "visible_to_customer"]
    list_filter = ["is_active", "is_customized", "visible_to_customer"]
    readonly_fields = ["updated_at", "updated_by", "is_customized"]


@admin.register(AIUsageLog)
class AIUsageLogAdmin(admin.ModelAdmin):
    list_display = ["created_at", "field_key", "action", "provider", "status", "is_test"]
    list_filter = ["provider", "status", "is_test"]
    search_fields = ["field_key", "action"]
    readonly_fields = [f.name for f in AIUsageLog._meta.fields]
