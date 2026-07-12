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

    # --- Busca semântica (embeddings) -----------------------------------
    # Combina a busca lexical com similaridade vetorial: encontra OS por
    # SIGNIFICADO ("luz do freio acesa" acha "lâmpada de stop acesa"). Desligada
    # por padrão -- precisa de um provedor de embeddings configurado. Quando
    # indisponível, a busca cai no modo lexical (fallback), sem falhar.
    semantic_enabled = models.BooleanField(default=False)
    embedding_provider = models.CharField(max_length=20, default="openai")
    embedding_model = models.CharField(max_length=100, default="text-embedding-3-small")
    embedding_base_url = models.CharField(
        max_length=300, default="https://api.openai.com/v1"
    )
    # Nome da variável de ambiente com a chave (a chave NUNCA fica no banco).
    embedding_api_key_env = models.CharField(
        max_length=100, default="SMART_SEARCH_EMBEDDING_KEY"
    )
    # Dimensão do vetor (menor = mais rápido; text-embedding-3-* aceita reduzir).
    embedding_dimensions = models.PositiveSmallIntegerField(default=512)
    # Similaridade mínima (cosseno, 0-1) para um resultado semântico entrar.
    similarity_threshold = models.FloatField(default=0.78)

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


class WorkOrderEmbedding(models.Model):
    """Embedding vetorial do texto (visível ao cliente) de uma OS.

    Guardado como lista de floats (JSON) -- sem depender de extensão do banco.
    ``source_hash`` permite recomputar só quando o texto muda. Observações
    internas NÃO entram no texto embutido, para não vazar por similaridade.
    """

    order = models.OneToOneField(
        "orders.WorkOrder",
        on_delete=models.CASCADE,
        related_name="search_embedding",
    )
    embedding = models.JSONField(default=list)
    source_hash = models.CharField(max_length=64, db_index=True)
    model = models.CharField(max_length=100, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Embedding OS {self.order_id}"
