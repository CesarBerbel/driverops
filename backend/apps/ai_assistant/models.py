from django.conf import settings
from django.db import models

from .fields import (
    AUDIENCES,
    DEFAULT_GLOBAL_PROMPT,
    DETAIL_LEVELS,
    FIELD_CHOICES,
    TONES,
    default_field,
)


class AISettings(models.Model):
    """Configuração global do módulo de IA (registro único, pk=1).

    Provedor/modelo/limites e o prompt global aplicado antes das instruções de
    cada campo. A chave de API NUNCA é armazenada aqui: guardamos apenas o nome
    da variável de ambiente que a contém (padrão de segredos do projeto).
    """

    class Provider(models.TextChoices):
        ANTHROPIC = "anthropic", "Anthropic (Claude)"
        OPENAI = "openai", "OpenAI"
        GEMINI = "gemini", "Gemini"
        CUSTOM = "custom", "Outro (compatível OpenAI)"

    is_active = models.BooleanField(default=False)
    provider = models.CharField(
        max_length=20, choices=Provider.choices, default=Provider.ANTHROPIC
    )
    model = models.CharField(max_length=80, default="claude-opus-4-8")
    # Override de endpoint (provedor custom/gemini). Vazio = padrão do provedor.
    base_url = models.CharField(max_length=300, blank=True)
    # Nome da variável de ambiente com a chave. Vazio = padrão do provedor.
    api_key_env = models.CharField(max_length=80, blank=True)
    temperature = models.FloatField(default=0.3)
    max_tokens = models.PositiveIntegerField(default=1200)
    timeout_seconds = models.PositiveIntegerField(default=30)
    global_prompt = models.TextField(default=DEFAULT_GLOBAL_PROMPT)
    # Privacidade: por padrão NÃO guardamos os textos enviados/retornados no log.
    log_texts = models.BooleanField(default=False)
    retention_days = models.PositiveIntegerField(default=30)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_settings_updated",
    )

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return "Configurações do Assistente de IA"


class AIFieldInstruction(models.Model):
    """Instrução da IA para um campo textual da OS.

    Conteúdo editável por campo; os textos de fábrica vivem em
    :mod:`apps.ai_assistant.fields`. ``apply_default`` restaura os valores padrão.
    """

    field_key = models.CharField(max_length=40, choices=FIELD_CHOICES, unique=True)
    name = models.CharField(max_length=120)
    description = models.CharField(max_length=255, blank=True)
    instruction = models.TextField()
    tone = models.CharField(max_length=20, choices=TONES, default="objective")
    detail_level = models.CharField(
        max_length=20, choices=DETAIL_LEVELS, default="normal"
    )
    audience = models.CharField(max_length=20, choices=AUDIENCES, default="internal")
    can_rewrite = models.BooleanField(default=True)
    can_fix_grammar = models.BooleanField(default=True)
    can_summarize = models.BooleanField(default=True)
    can_expand = models.BooleanField(default=True)
    use_context = models.BooleanField(default=True)
    allowed_context = models.JSONField(default=list, blank=True)
    preserve_technical_terms = models.BooleanField(default=True)
    keep_first_person = models.BooleanField(default=False)
    remove_slang = models.BooleanField(default=True)
    visible_to_customer = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_customized = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_field_instructions_updated",
    )

    _DEFAULT_FIELDS = [
        "name", "description", "instruction", "tone", "detail_level", "audience",
        "can_rewrite", "can_fix_grammar", "can_summarize", "can_expand",
        "use_context", "allowed_context", "preserve_technical_terms",
        "keep_first_person", "remove_slang", "visible_to_customer",
    ]

    class Meta:
        ordering = ["field_key"]

    def __str__(self):
        return self.get_field_key_display()

    def apply_default(self):
        defaults = default_field(self.field_key)
        for attr in self._DEFAULT_FIELDS:
            setattr(self, attr, defaults[attr])
        self.is_active = True
        self.is_customized = False


class AIUsageLog(models.Model):
    """Registro de cada uso da IA (geração/teste), com status e metadados.

    Os textos enviados/retornados só são gravados quando ``AISettings.log_texts``
    está ativo (política de privacidade configurável).
    """

    class Status(models.TextChoices):
        SUCCESS = "success", "Sucesso"
        FAILED = "failed", "Falhou"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_usage_logs",
    )
    work_order = models.ForeignKey(
        "orders.WorkOrder",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_usage_logs",
    )
    field_key = models.CharField(max_length=40)
    action = models.CharField(max_length=40)
    provider = models.CharField(max_length=20)
    model = models.CharField(max_length=80, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices)
    error_code = models.CharField(max_length=40, blank=True)
    error = models.TextField(blank=True)
    input_tokens = models.PositiveIntegerField(null=True, blank=True)
    output_tokens = models.PositiveIntegerField(null=True, blank=True)
    is_test = models.BooleanField(default=False)
    applied = models.BooleanField(null=True, blank=True)
    # Só preenchidos quando log_texts está ativo.
    input_text = models.TextField(blank=True)
    output_text = models.TextField(blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.field_key}/{self.action} ({self.status})"
