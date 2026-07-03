import re


def only_digits(value: str) -> str:
    return re.sub(r"\D", "", value or "")
