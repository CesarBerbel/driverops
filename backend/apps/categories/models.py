from django.db import models
from django.db.models.functions import Lower


class Category(models.Model):
    class CategoryType(models.TextChoices):
        CLIENT = "client", "Cliente"
        PART = "part", "Peça"
        SERVICE = "service", "Serviço"

    category_type = models.CharField(
        max_length=20, choices=CategoryType.choices, db_index=True
    )
    name = models.CharField(max_length=100)
    description = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    # Internal soft-delete flag. Never rendered as a "Status"/"Ativo" field in
    # the UI -- it only decides which action (Excluir/Reativar) is offered
    # and which bucket the status filter's friendly labels map to.
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "categories"
        constraints = [
            # Impede, no banco, duas categorias ATIVAS do mesmo tipo com o mesmo
            # nome (case-insensitive) -- fecha a corrida do check aplicacional
            # que gerava duplicidade. Categorias inativas não entram na regra.
            models.UniqueConstraint(
                "category_type",
                Lower("name"),
                condition=models.Q(is_active=True),
                name="uniq_active_category_type_name",
            )
        ]

    def __str__(self):
        return self.name

    @classmethod
    def has_active_conflict(cls, category_type, name, exclude_pk=None):
        conflict = cls.objects.filter(
            is_active=True, category_type=category_type, name__iexact=name
        )
        if exclude_pk is not None:
            conflict = conflict.exclude(pk=exclude_pk)
        return conflict.exists()
