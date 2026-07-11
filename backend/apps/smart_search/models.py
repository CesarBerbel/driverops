from django.conf import settings
from django.db import models

from apps.core.models import SingletonModel


class SmartSearchSettings(SingletonModel):
    """Configuração global (single-tenant) da Busca Inteligente.

    A busca funciona sempre por heurística segura; a IA é opcional e serve só
    para interpretar a intenção e expandir termos. Quando desligada/indisponível,
    a busca cai para o modo heurístico (fallback) sem falhar.
    """

    # Usa a IA (via apps.ai_assistant) para interpretar a pergunta. Se False, ou
    # se a IA estiver indisponível, a busca usa apenas heurística.
    use_ai = models.BooleanField(default=True)
    # Permite que trechos de observações internas apareçam nos resultados.
    include_internal_notes = models.BooleanField(default=True)
    # Permite resultados financeiros (ainda assim exige financial.view do usuário).
    include_financial = models.BooleanField(default=True)
    # Limite padrão de resultados por busca.
    result_limit = models.PositiveSmallIntegerField(default=20)
    # Guarda histórico de buscas por usuário (buscas recentes).
    store_history = models.BooleanField(default=True)
    # Registra logs de uso (auditoria).
    log_queries = models.BooleanField(default=True)
    # Retenção de logs/histórico em dias (0 = sem expurgo automático).
    retention_days = models.PositiveIntegerField(default=90)

    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    class Meta:
        verbose_name = "Configuração da Busca Inteligente"
        verbose_name_plural = "Configuração da Busca Inteligente"

    def __str__(self):
        return "Configuração da Busca Inteligente"


class SearchLog(models.Model):
    """Log de uso da Busca Inteligente (auditoria/observabilidade)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.SET_NULL,
        related_name="search_logs",
    )
    query = models.CharField(max_length=500)
    interpreted = models.JSONField(default=dict, blank=True)
    applied_filters = models.JSONField(default=list, blank=True)
    result_count = models.PositiveIntegerField(default=0)
    used_ai = models.BooleanField(default=False)
    duration_ms = models.PositiveIntegerField(default=0)
    error = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.query[:40]} ({self.result_count})"


class RecentSearch(models.Model):
    """Buscas recentes por usuário (deduplicadas pelo texto normalizado)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="recent_searches",
    )
    query = models.CharField(max_length=500)
    normalized = models.CharField(max_length=500)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "normalized"], name="uniq_recent_per_user"
            )
        ]

    def __str__(self):
        return self.query


class SavedSearch(models.Model):
    """Buscas salvas por usuário (atalhos reutilizáveis)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="saved_searches",
    )
    label = models.CharField(max_length=120)
    query = models.CharField(max_length=500)
    filters = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.label
