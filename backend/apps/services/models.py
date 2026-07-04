from django.db import models


class Service(models.Model):
    name = models.CharField(max_length=150)
    category = models.ForeignKey(
        "categories.Category",
        on_delete=models.PROTECT,
        related_name="services",
    )
    description = models.TextField(blank=True)
    labor_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    estimated_minutes = models.PositiveIntegerField(null=True, blank=True)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class ServicePart(models.Model):
    # Through row linking a Service to a standard Part plus a suggested
    # quantity. PROTECT on `part` documents intent, but Parts use soft delete
    # (never physically removed), so it never actually fires.
    service = models.ForeignKey(
        Service, on_delete=models.CASCADE, related_name="standard_parts"
    )
    part = models.ForeignKey(
        "parts.Part", on_delete=models.PROTECT, related_name="service_links"
    )
    suggested_quantity = models.DecimalField(max_digits=12, decimal_places=2, default=1)

    class Meta:
        unique_together = [("service", "part")]
        ordering = ["id"]

    def __str__(self):
        return f"{self.service.name} — {self.part.name}"


class ServicePackage(models.Model):
    class DiscountType(models.TextChoices):
        NONE = "none", "Nenhum"
        PERCENT = "percent", "Percentual"
        FIXED = "fixed", "Valor fixo"

    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    discount_type = models.CharField(
        max_length=10, choices=DiscountType.choices, default=DiscountType.NONE
    )
    discount_value = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class PackageService(models.Model):
    # Through row linking a ServicePackage to a Service. Same PROTECT/soft-delete
    # reasoning as ServicePart.
    package = models.ForeignKey(
        ServicePackage, on_delete=models.CASCADE, related_name="items"
    )
    service = models.ForeignKey(
        Service, on_delete=models.PROTECT, related_name="package_links"
    )

    class Meta:
        unique_together = [("package", "service")]
        ordering = ["id"]

    def __str__(self):
        return f"{self.package.name} — {self.service.name}"
