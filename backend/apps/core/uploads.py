"""Validação e saneamento central de uploads.

Todos os uploads do sistema (anexos de OS, fotos de check-in, documento
assinado do orçamento, logo da oficina) passam por aqui. As regras não confiam
no ``content_type`` declarado pelo cliente (facilmente forjável): a checagem é
por **assinatura (magic bytes)** do conteúdo real, com limite de tamanho e nome
de arquivo saneado.
"""

import re
import unicodedata

from rest_framework.exceptions import ValidationError

# Tamanho padrão máximo de upload (10 MB). Endpoints podem passar outro limite.
DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024


def _is_pdf(head: bytes) -> bool:
    return head[:5] == b"%PDF-"


def _is_image(head: bytes) -> bool:
    return (
        head.startswith(b"\x89PNG\r\n\x1a\n")  # PNG
        or head.startswith(b"\xff\xd8\xff")  # JPEG
        or head[:6] in (b"GIF87a", b"GIF89a")  # GIF
        or (head[:4] == b"RIFF" and head[8:12] == b"WEBP")  # WEBP
    )


def sniff_kind(file) -> str | None:
    """Detecta o tipo real pelo conteúdo: ``"image"``, ``"pdf"`` ou ``None``."""
    pos = file.tell() if hasattr(file, "tell") else 0
    head = file.read(12)
    if hasattr(file, "seek"):
        file.seek(pos)
    if _is_image(head):
        return "image"
    if _is_pdf(head):
        return "pdf"
    return None


def is_supported_image(file) -> bool:
    """Compatível com o check antigo do logo: True se o conteúdo é imagem."""
    return sniff_kind(file) == "image"


def sanitize_filename(name: str, *, fallback: str = "arquivo") -> str:
    """Nome de arquivo seguro: sem caminho, sem caracteres perigosos, curto.

    Remove diretórios (path traversal), normaliza acentos, mantém só
    ``[A-Za-z0-9._-]`` e limita o tamanho, preservando a extensão.
    """
    name = (name or "").replace("\\", "/").split("/")[-1]
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._") or fallback
    if "." in name:
        stem, ext = name.rsplit(".", 1)
        stem = (stem or fallback)[:100]
        ext = re.sub(r"[^A-Za-z0-9]+", "", ext)[:10]
        name = f"{stem}.{ext}" if ext else stem
    return name[:120]


def validate_upload(
    file,
    *,
    max_bytes: int = DEFAULT_MAX_UPLOAD_BYTES,
    allow_pdf: bool = True,
    field: str = "file",
) -> str:
    """Valida tamanho e tipo real (magic bytes) de um upload.

    Levanta ``ValidationError`` amigável se o arquivo for grande demais ou não
    for uma imagem (nem PDF, quando permitido). Devolve o tipo detectado.
    """
    if file is None:
        raise ValidationError({field: ["Envie um arquivo."]})
    size = getattr(file, "size", None)
    if size is not None and size > max_bytes:
        mb = max_bytes // (1024 * 1024)
        raise ValidationError({field: [f"O arquivo excede o limite de {mb} MB."]})
    kind = sniff_kind(file)
    allowed = {"image"} | ({"pdf"} if allow_pdf else set())
    if kind not in allowed:
        msg = (
            "Envie uma imagem (PNG, JPG, WEBP ou GIF) ou PDF."
            if allow_pdf
            else "Envie uma imagem válida (PNG, JPG, WEBP ou GIF)."
        )
        raise ValidationError({field: [msg]})
    return kind
