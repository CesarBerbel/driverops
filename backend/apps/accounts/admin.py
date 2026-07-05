from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import AuditLog, Permission, Role, User, UserPermission


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ["codename", "module", "action", "is_critical"]
    list_filter = ["module", "is_critical"]
    search_fields = ["codename"]


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ["key", "name", "is_system"]
    filter_horizontal = ["permissions"]


@admin.register(UserPermission)
class UserPermissionAdmin(admin.ModelAdmin):
    list_display = ["user", "permission", "grant_type"]
    list_filter = ["grant_type"]


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ["created_at", "action", "actor", "target_user"]
    list_filter = ["action"]
    readonly_fields = [f.name for f in AuditLog._meta.fields]


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ["email"]
    list_display = ["email", "full_name", "role", "is_superuser", "is_active"]
    list_filter = ["role", "is_staff", "is_superuser", "is_active"]
    search_fields = ["email", "full_name"]
    readonly_fields = ["date_joined", "last_login"]
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (
            "Informações pessoais",
            {"fields": ("full_name", "phone", "whatsapp", "notes")},
        ),
        (
            "Perfil e permissões",
            {
                "fields": (
                    "role",
                    "technical_specialty",
                    "force_password_change",
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        ("Datas importantes", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "full_name",
                    "password1",
                    "password2",
                    "is_staff",
                    "is_superuser",
                ),
            },
        ),
    )
