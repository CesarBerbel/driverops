from django.db import models


class Supplier(models.Model):
    class SupplierType(models.TextChoices):
        INDIVIDUAL = "individual", "Pessoa Física"
        COMPANY = "company", "Pessoa Jurídica"

    name = models.CharField(max_length=150)
    trade_name = models.CharField(max_length=150, blank=True)
    supplier_type = models.CharField(
        max_length=20, choices=SupplierType.choices, default=SupplierType.COMPANY
    )
    # document/phone/whatsapp/zip_code are always stored digits-only -- see
    # SupplierSerializer's validate_* methods, which normalize on the way in.
    document = models.CharField(max_length=14, blank=True)
    state_registration = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=11, blank=True)
    whatsapp = models.CharField(max_length=11, blank=True)
    contact_name = models.CharField(max_length=150, blank=True)
    zip_code = models.CharField(max_length=8, blank=True)
    street = models.CharField(max_length=200, blank=True)
    number = models.CharField(max_length=20, blank=True)
    complement = models.CharField(max_length=100, blank=True)
    neighborhood = models.CharField(max_length=100, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=2, blank=True)
    country = models.CharField(max_length=60, blank=True, default="Brasil")
    notes = models.TextField(blank=True)
    # Internal soft-delete flag. Never rendered as a "Status"/"Ativo" field in
    # the UI -- it only decides which action (Excluir/Reativar) is offered
    # and which bucket the status filter's friendly labels map to.
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name
