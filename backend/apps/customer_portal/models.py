"""Portal de consulta do veículo para o cliente.

Acesso público e temporário à consulta de um veículo, por link mágico enviado ao
e-mail cadastrado. O token nunca é salvo em texto puro -- guardamos só o hash
(SHA-256); o valor real vai apenas na URL/e-mail.
"""

import hashlib
import secrets
from datetime import timedelta

from django.db import models
from django.utils import timezone

from apps.core.models import SingletonModel


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class CustomerPortalSettings(SingletonModel):
    """Configuração do portal (registro único). Editável no Django admin."""

    enabled = models.BooleanField(default=True)
    # Exigir só placa, ou placa + e-mail (defesa extra contra enumeração).
    require_email = models.BooleanField(default=False)
    link_validity_hours = models.PositiveIntegerField(default=5)
    # Uso único (invalida após o 1º acesso) ou reutilizável até expirar.
    single_use_token = models.BooleanField(default=False)
    # Tempo mínimo entre reenvios para a MESMA placa (anti-abuso).
    resend_cooldown_seconds = models.PositiveIntegerField(default=300)
    show_history = models.BooleanField(default=True)
    allow_messages = models.BooleanField(default=True)
    allow_pdf_download = models.BooleanField(default=True)
    notify_on_access = models.BooleanField(default=False)
    notify_on_message = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return "Configurações do Portal do Cliente"


class VehicleAccessToken(models.Model):
    """Link mágico de acesso à área do veículo (token hasheado)."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Ativo"
        USED = "used", "Usado"
        EXPIRED = "expired", "Expirado"
        REVOKED = "revoked", "Revogado"

    customer = models.ForeignKey(
        "customers.Customer", on_delete=models.CASCADE, related_name="portal_tokens"
    )
    vehicle = models.ForeignKey(
        "vehicles.Vehicle", on_delete=models.CASCADE, related_name="portal_tokens"
    )
    email = models.EmailField()
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    revoked = models.BooleanField(default=False)

    request_ip = models.GenericIPAddressField(null=True, blank=True)
    request_user_agent = models.CharField(max_length=300, blank=True)
    access_ip = models.GenericIPAddressField(null=True, blank=True)
    access_user_agent = models.CharField(max_length=300, blank=True)
    access_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"Acesso {self.vehicle_id} ({self.get_computed_status_display()})"

    @classmethod
    def issue(
        cls, *, customer, vehicle, email, validity_hours, request_ip=None, user_agent=""
    ):
        """Cria um token e devolve (obj, token_bruto). Só o hash é persistido."""
        raw = secrets.token_urlsafe(32)
        obj = cls.objects.create(
            customer=customer,
            vehicle=vehicle,
            email=email,
            token_hash=hash_token(raw),
            expires_at=timezone.now() + timedelta(hours=validity_hours),
            request_ip=request_ip,
            request_user_agent=(user_agent or "")[:300],
        )
        return obj, raw

    @property
    def computed_status(self) -> str:
        if self.revoked:
            return self.Status.REVOKED
        if self.used_at:
            return self.Status.USED
        if timezone.now() > self.expires_at:
            return self.Status.EXPIRED
        return self.Status.ACTIVE

    def get_computed_status_display(self) -> str:
        return dict(self.Status.choices)[self.computed_status]

    def is_valid(self, *, single_use: bool) -> bool:
        if self.revoked or timezone.now() > self.expires_at:
            return False
        if single_use and self.used_at:
            return False
        return True


class PortalMessage(models.Model):
    """Mensagem enviada pelo cliente pela área do veículo."""

    class Kind(models.TextChoices):
        QUOTE = "quote", "Dúvida sobre orçamento"
        PROGRESS = "progress", "Dúvida sobre andamento"
        CALLBACK = "callback", "Quero que me liguem"
        PICKUP = "pickup", "Combinar retirada"
        OTHER = "other", "Outro"

    token = models.ForeignKey(
        VehicleAccessToken, on_delete=models.CASCADE, related_name="messages"
    )
    customer = models.ForeignKey(
        "customers.Customer", on_delete=models.CASCADE, related_name="portal_messages"
    )
    vehicle = models.ForeignKey(
        "vehicles.Vehicle", on_delete=models.CASCADE, related_name="portal_messages"
    )
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.OTHER)
    message = models.TextField()
    preferred_time = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.get_kind_display()} — veículo {self.vehicle_id}"
