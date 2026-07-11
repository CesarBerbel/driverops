"""Validação e saneamento central de uploads.

Todos os uploads do sistema (anexos de OS, fotos de check-in, documento
assinado do orçamento, logo da oficina) passam por aqui. As regras não confiam
no ``content_type`` declarado pelo cliente (facilmente forjável): a checagem é
por **assinatura (magic bytes)** do conteúdo real, com limite de tamanho e nome
de arquivo saneado.
"""

import re
import unicodedata
from io import BytesIO

from django.core.files.base import ContentFile
from rest_framework.exceptions import ValidationError

# Tamanho padrão máximo de upload (10 MB). Endpoints podem passar outro limite.
DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024

# Formato PIL -> extensão/mime canônicos. A extensão de saída vem SEMPRE do
# conteúdo real (nunca do nome enviado pelo cliente).
_IMAGE_EXT = {"PNG": "png", "JPEG": "jpg", "WEBP": "webp", "GIF": "gif"}
_EXT_MIME = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "webp": "image/webp",
    "gif": "image/gif",
    "pdf": "application/pdf",
}


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


def _safe_stem(name: str, fallback: str) -> str:
    """Nome-base seguro (sem diretório, sem extensão, sem caracteres perigosos)."""
    base = (name or "").replace("\\", "/").split("/")[-1]
    base = unicodedata.normalize("NFKD", base).encode("ascii", "ignore").decode()
    stem = base.rsplit(".", 1)[0] if "." in base else base
    stem = re.sub(r"[^A-Za-z0-9._-]+", "_", stem).strip("._")
    return (stem or fallback)[:100]


def reencode_image(file) -> tuple[bytes, str]:
    """Decodifica e RE-CODIFICA a imagem (decode -> encode).

    Só os pixels decodificados são re-serializados, então qualquer conteúdo
    não-imagem embutido (EXIF, comentários, apêndices/polyglots, scripts em
    metadados) é descartado. Devolve ``(bytes, extensão)`` no formato detectado.
    """
    from PIL import Image

    if hasattr(file, "seek"):
        file.seek(0)
    with Image.open(file) as img:
        img.load()  # força a decodificação (dispara erro em bomba/arquivo corrompido)
        fmt = (img.format or "PNG").upper()
        if fmt not in _IMAGE_EXT:
            fmt = "PNG"
        # JPEG não suporta canal alfa/paleta; converte antes de re-salvar.
        if fmt == "JPEG" and img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        buffer = BytesIO()
        save_kwargs = {"format": fmt}
        if fmt == "JPEG":
            save_kwargs.update(quality=90, optimize=True)
        img.save(buffer, **save_kwargs)
    return buffer.getvalue(), _IMAGE_EXT[fmt]


def sanitized_upload(
    file,
    *,
    max_bytes: int = DEFAULT_MAX_UPLOAD_BYTES,
    allow_pdf: bool = True,
    field: str = "file",
    fallback: str = "arquivo",
) -> ContentFile:
    """Valida, re-codifica (imagens) e devolve um ``ContentFile`` pronto para
    salvar, com nome saneado e **extensão derivada do conteúdo** -- nunca da
    extensão enviada pelo cliente. O ``content_type`` do resultado também vem do
    conteúdo real (confiável). Levanta ``ValidationError`` se inválido.
    """
    kind = validate_upload(file, max_bytes=max_bytes, allow_pdf=allow_pdf, field=field)
    stem = _safe_stem(getattr(file, "name", ""), fallback)
    if kind == "image":
        try:
            content, ext = reencode_image(file)
        except ValidationError:
            raise
        except Exception:
            raise ValidationError(
                {field: ["Não foi possível processar a imagem enviada."]}
            )
    else:  # PDF: validado por magic bytes; extensão forçada para .pdf.
        if hasattr(file, "seek"):
            file.seek(0)
        content = file.read()
        ext = "pdf"
    result = ContentFile(content, name=f"{stem}.{ext}")
    # ContentFile não tem content_type; anexamos um confiável (derivado do tipo).
    result.content_type = _EXT_MIME[ext]
    return result


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
