"""Renderização e validação de templates de notificação.

- ``render`` substitui ``{{grupo.chave}}`` pelos valores do contexto;
- ``extract_variables`` / ``unknown_variables`` inspecionam o template;
- ``validate_template_fields`` valida campos obrigatórios, variáveis inexistentes
  e HTML minimamente bem-formado (usado antes de salvar e antes de enviar);
- ``html_to_text`` gera um fallback em texto puro a partir do HTML.
"""

import re
from html import escape as html_escape
from html import unescape
from html.parser import HTMLParser

from .variables import ALL_VARIABLE_KEYS

# {{ grupo.chave }} com espaços opcionais.
_VAR_RE = re.compile(r"\{\{\s*([a-zA-Z_][\w]*(?:\.[a-zA-Z_][\w]*)*)\s*\}\}")


def extract_variables(*texts):
    """Conjunto de chaves ``{{...}}`` referenciadas nos textos informados."""
    found = set()
    for text in texts:
        if not text:
            continue
        found.update(_VAR_RE.findall(text))
    return found


def unknown_variables(*texts):
    """Chaves referenciadas que não existem no catálogo (ordenadas)."""
    return sorted(extract_variables(*texts) - ALL_VARIABLE_KEYS)


def render(text, context, *, escape=False):
    """Substitui as variáveis conhecidas; chaves ausentes viram string vazia.

    Com ``escape=True`` os **valores** substituídos são escapados como HTML
    (o template em si não é tocado). Use ao renderizar o corpo HTML de e-mails,
    pois parte do contexto vem de entrada não confiável (ex.: nome de cliente
    criado a partir de um pedido público) e não deve injetar marcação.
    """
    if not text:
        return ""

    def _sub(match):
        key = match.group(1)
        value = str(context.get(key, ""))
        return html_escape(value) if escape else value

    return _VAR_RE.sub(_sub, text)


def _has_dangling_braces(text):
    # Remove as variáveis válidas e verifica se sobraram '{{' ou '}}' soltos.
    stripped = _VAR_RE.sub("", text or "")
    return "{{" in stripped or "}}" in stripped


class _Balanced(HTMLParser):
    """Detecta tags de bloco não fechadas de forma tolerante."""

    #: tags que não exigem fechamento
    VOID = {
        "area", "base", "br", "col", "embed", "hr", "img", "input",
        "link", "meta", "param", "source", "track", "wbr", "!doctype",
    }

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.ok = True

    def handle_starttag(self, tag, attrs):
        if tag not in self.VOID:
            self.stack.append(tag)

    def handle_startendtag(self, tag, attrs):
        pass

    def handle_endtag(self, tag):
        if tag in self.VOID:
            return
        if tag in self.stack:
            # Fecha até a tag correspondente (tolera aninhamento impreciso).
            while self.stack and self.stack.pop() != tag:
                pass
        else:
            self.ok = False


def _html_is_wellformed(html):
    if not html:
        return True
    # Contagem grosseira de '<' vs '>' pega tags truncadas.
    if html.count("<") != html.count(">"):
        return False
    parser = _Balanced()
    try:
        parser.feed(html)
        parser.close()
    except Exception:  # pragma: no cover - parser é tolerante
        return False
    return parser.ok and not parser.stack


def validate_template_fields(*, channel, name, subject, html_content, text_content):
    """Valida os campos de um template. Devolve lista de erros (vazia = ok).

    Regras:
    - nome obrigatório;
    - e-mail exige assunto e conteúdo HTML; demais canais exigem texto;
    - todo canal exige o fallback em texto puro;
    - nenhuma variável pode ser inexistente no catálogo;
    - o HTML precisa estar minimamente bem-formado.
    """
    errors = []
    if not (name or "").strip():
        errors.append("Informe o nome do template.")

    if channel == "email":
        if not (subject or "").strip():
            errors.append("O assunto é obrigatório para o canal de e-mail.")
        if not (html_content or "").strip():
            errors.append("O conteúdo HTML é obrigatório para o canal de e-mail.")
    else:
        if not (text_content or "").strip():
            errors.append("O conteúdo da mensagem é obrigatório.")

    if not (text_content or "").strip():
        errors.append("O conteúdo em texto puro (fallback) é obrigatório.")

    unknown = unknown_variables(subject, html_content, text_content)
    if unknown:
        readable = ", ".join(f"{{{{{key}}}}}" for key in unknown)
        errors.append(f"Variáveis inexistentes: {readable}.")

    for label, value in (("assunto", subject), ("HTML", html_content), ("texto", text_content)):
        if value and _has_dangling_braces(value):
            errors.append(f"Há chaves de variável mal formadas no campo {label}.")

    if html_content and not _html_is_wellformed(html_content):
        errors.append("O conteúdo HTML está malformado (verifique as tags).")

    return errors


# --- HTML -> texto puro -------------------------------------------------------

_BLOCK_TAGS = {
    "p", "div", "br", "tr", "li", "h1", "h2", "h3", "h4", "table", "ul", "ol",
}


class _TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self._skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("style", "script", "head"):
            self._skip += 1
        if tag in self._BLOCK_TAGS_START:
            self.parts.append("\n")

    _BLOCK_TAGS_START = _BLOCK_TAGS

    def handle_endtag(self, tag):
        if tag in ("style", "script", "head"):
            self._skip = max(0, self._skip - 1)
        if tag in self._BLOCK_TAGS_START:
            self.parts.append("\n")

    def handle_data(self, data):
        if self._skip:
            return
        self.parts.append(data)


def html_to_text(html):
    """Extrai um texto puro legível a partir do HTML (para gerar o fallback)."""
    if not html:
        return ""
    extractor = _TextExtractor()
    extractor.feed(html)
    text = unescape("".join(extractor.parts))
    # Colapsa espaços em cada linha e limita linhas em branco consecutivas.
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.splitlines()]
    out = []
    blanks = 0
    for line in lines:
        if line:
            out.append(line)
            blanks = 0
        else:
            blanks += 1
            if blanks <= 1:
                out.append("")
    return "\n".join(out).strip()
