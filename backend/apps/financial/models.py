from django.conf import settings
from django.db import models


class Payment(models.Model):
    """Um pagamento recebido contra uma Ordem de Serviço.

    Vários pagamentos podem ser lançados na mesma OS (pagamento parcial). O saldo
    devedor e o status de pagamento da OS são calculados no serializer da OS
    (fonte da verdade no backend) a partir do valor final menos a soma dos
    pagamentos -- nunca persistidos.
    """

    class Method(models.TextChoices):
        CASH = "cash", "Dinheiro"
        PIX = "pix", "Pix"
        DEBIT = "debit", "Cartão de débito"
        CREDIT = "credit", "Cartão de crédito"
        TRANSFER = "transfer", "Transferência"
        BOLETO = "boleto", "Boleto"
        OTHER = "other", "Outro"

    order = models.ForeignKey(
        "orders.WorkOrder", on_delete=models.CASCADE, related_name="payments"
    )
    # Decimal (nunca float) -- dinheiro precisa de matemática exata.
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    method = models.CharField(max_length=20, choices=Method.choices, default=Method.PIX)
    paid_at = models.DateField()
    note = models.CharField(max_length=200, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="+",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-paid_at", "-id"]

    def __str__(self):
        return f"Pagamento de {self.amount} (OS #{self.order_id})"
