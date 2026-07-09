import re


def only_digits(value: str) -> str:
    return re.sub(r"\D", "", value or "")


def find_customer_conflicts(*, phone="", whatsapp="", document="", exclude_pk=None):
    """Aponta clientes que já usam o mesmo telefone/WhatsApp/documento informado.

    Um número de telefone identifica um único cliente: ``phone`` e ``whatsapp``
    compartilham o mesmo espaço, então um número usado por outro cliente em
    qualquer um dos dois campos é conflito. Documento só conflita quando
    informado. Devolve ``{campo: Customer}`` para cada colisão (vazio se nenhuma).
    Valores devem chegar já normalizados (somente dígitos).
    """
    from django.db.models import Q

    from .models import Customer

    base = Customer.objects.all()
    if exclude_pk:
        base = base.exclude(pk=exclude_pk)

    conflicts = {}
    if phone:
        other = base.filter(Q(phone=phone) | Q(whatsapp=phone)).first()
        if other:
            conflicts["phone"] = other
    if whatsapp and whatsapp != phone:
        other = base.filter(Q(phone=whatsapp) | Q(whatsapp=whatsapp)).first()
        if other:
            conflicts["whatsapp"] = other
    if document:
        other = base.filter(document=document).first()
        if other:
            conflicts["document"] = other
    return conflicts
