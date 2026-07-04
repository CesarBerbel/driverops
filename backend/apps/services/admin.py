from django.contrib import admin

from .models import PackageService, Service, ServicePackage, ServicePart


class ServicePartInline(admin.TabularInline):
    model = ServicePart
    extra = 0
    autocomplete_fields = ["part"]


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ["name", "category", "labor_cost", "is_active", "updated_at"]
    list_filter = ["is_active", "category"]
    search_fields = ["name", "category__name"]
    inlines = [ServicePartInline]


class PackageServiceInline(admin.TabularInline):
    model = PackageService
    extra = 0
    autocomplete_fields = ["service"]


@admin.register(ServicePackage)
class ServicePackageAdmin(admin.ModelAdmin):
    list_display = ["name", "discount_type", "is_active", "updated_at"]
    list_filter = ["is_active", "discount_type"]
    search_fields = ["name"]
    inlines = [PackageServiceInline]
