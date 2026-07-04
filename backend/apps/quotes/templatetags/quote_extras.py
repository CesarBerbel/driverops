from django import template

register = template.Library()


@register.filter
def format_cnpj(value):
    digits = "".join(c for c in str(value or "") if c.isdigit())
    if len(digits) != 14:
        return value
    return f"{digits[:2]}.{digits[2:5]}.{digits[5:8]}/{digits[8:12]}-{digits[12:]}"


@register.filter
def format_phone(value):
    digits = "".join(c for c in str(value or "") if c.isdigit())
    if len(digits) == 11:
        return f"({digits[:2]}) {digits[2:7]}-{digits[7:]}"
    if len(digits) == 10:
        return f"({digits[:2]}) {digits[2:6]}-{digits[6:]}"
    return value


@register.filter
def format_plate(value):
    plate = str(value or "").upper().replace("-", "").replace(" ", "")
    # Placa antiga (ABC1234) recebe hífen; Mercosul (ABC1D23) fica sem.
    if len(plate) == 7 and plate[4].isdigit():
        return f"{plate[:3]}-{plate[3:]}"
    return plate
