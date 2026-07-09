from django.db import models


class Customer(models.Model):
    class CustomerType(models.TextChoices):
        INDIVIDUAL = "individual", "Pessoa Física"
        COMPANY = "company", "Pessoa Jurídica"

    name = models.CharField(max_length=150)
    customer_type = models.CharField(
        max_length=20, choices=CustomerType.choices, default=CustomerType.INDIVIDUAL
    )
    email = models.EmailField(blank=True)
    # phone/whatsapp/document/zip_code are always stored digits-only -- see
    # CustomerSerializer's validate_* methods, which normalize on the way in.
    phone = models.CharField(max_length=11, blank=True)
    whatsapp = models.CharField(max_length=11, blank=True)
    document = models.CharField(max_length=14, blank=True)
    zip_code = models.CharField(max_length=8, blank=True)
    street = models.CharField(max_length=200, blank=True)
    number = models.CharField(max_length=20, blank=True)
    complement = models.CharField(max_length=100, blank=True)
    neighborhood = models.CharField(max_length=100, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=2, blank=True)
    country = models.CharField(max_length=60, blank=True, default="Brasil")
    notes = models.TextField(blank=True)
    # Soft delete -- consistente com os demais cadastros (nunca exclui de fato).
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        # Rede de segurança no banco contra corrida (a validação de aplicação em
        # find_customer_conflicts cobre o caso cruzado telefone<->WhatsApp).
        constraints = [
            models.UniqueConstraint(
                fields=["phone"],
                condition=~models.Q(phone=""),
                name="uniq_customer_phone",
            ),
            models.UniqueConstraint(
                fields=["whatsapp"],
                condition=~models.Q(whatsapp=""),
                name="uniq_customer_whatsapp",
            ),
            models.UniqueConstraint(
                fields=["document"],
                condition=~models.Q(document=""),
                name="uniq_customer_document",
            ),
        ]

    def __str__(self):
        return self.name

    def clean(self):
        """Bloqueia telefone/documento duplicado (usado pelo admin via full_clean)."""
        from django.core.exceptions import ValidationError

        from .utils import find_customer_conflicts

        conflicts = find_customer_conflicts(
            phone=self.phone,
            whatsapp=self.whatsapp,
            document=self.document,
            exclude_pk=self.pk,
        )
        labels = {"phone": "telefone", "whatsapp": "WhatsApp", "document": "documento"}
        errors = {
            field: f"Já existe um cliente ({other.name}) com este {labels[field]}."
            for field, other in conflicts.items()
        }
        if errors:
            raise ValidationError(errors)
