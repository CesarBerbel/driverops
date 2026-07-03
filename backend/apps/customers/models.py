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
    # phone/document/zip_code are always stored digits-only -- see
    # CustomerSerializer's validate_* methods, which normalize on the way in.
    phone = models.CharField(max_length=11, blank=True)
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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name
