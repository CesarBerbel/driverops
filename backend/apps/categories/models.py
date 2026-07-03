from django.db import models


class Category(models.Model):
    name = models.CharField(max_length=100)
    description = models.CharField(max_length=255, blank=True)
    # Internal soft-delete flag. Never rendered as a "Status"/"Ativo" field in
    # the UI -- it only decides which action (Excluir/Reativar) is offered
    # and which bucket the status filter's friendly labels map to.
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name

    @classmethod
    def has_active_conflict(cls, name, exclude_pk=None):
        conflict = cls.objects.filter(is_active=True, name__iexact=name)
        if exclude_pk is not None:
            conflict = conflict.exclude(pk=exclude_pk)
        return conflict.exists()
