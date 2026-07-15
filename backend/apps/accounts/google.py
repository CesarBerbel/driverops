"""Verificação do ID token do Google (login/vínculo com Google).

O frontend obtém um ID token via Google Identity Services e o envia ao backend;
aqui ele é validado com a lib oficial ``google-auth`` (assinatura pela JWKS do
Google, ``aud`` == nosso client id, ``iss`` e ``exp``). Nada de client secret é
necessário para verificar um ID token.
"""

from django.conf import settings


class GoogleAuthError(Exception):
    """Falha (amigável) ao validar o ID token do Google."""


def google_login_enabled() -> bool:
    """True quando há um Client ID configurado (senão o login Google fica off)."""
    return bool(settings.GOOGLE_OAUTH_CLIENT_ID)


# Emissores aceitos para o ID token do Google.
_GOOGLE_ISSUERS = ("accounts.google.com", "https://accounts.google.com")


def verify_google_id_token(credential: str) -> dict:
    """Valida o ID token e devolve ``{sub, email, email_verified, name}``.

    Levanta :class:`GoogleAuthError` em qualquer falha (token inválido/expirado,
    ``aud`` errado, emissor inesperado, sem e-mail, etc.).
    """
    if not google_login_enabled():
        raise GoogleAuthError("Login com Google não está configurado.")
    if not credential:
        raise GoogleAuthError("Credencial do Google ausente.")

    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token

        claims = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            settings.GOOGLE_OAUTH_CLIENT_ID,
        )
    except ValueError:
        # Assinatura/aud/exp inválidos, formato errado, etc.
        raise GoogleAuthError(
            "Não foi possível validar sua conta Google. Tente novamente."
        ) from None

    if claims.get("iss") not in _GOOGLE_ISSUERS:
        raise GoogleAuthError("Emissor do token Google inválido.")

    sub = claims.get("sub")
    email = (claims.get("email") or "").strip().lower()
    if not sub or not email:
        raise GoogleAuthError("Conta Google sem identificador ou e-mail.")

    return {
        "sub": sub,
        "email": email,
        "email_verified": bool(claims.get("email_verified")),
        "name": claims.get("name") or "",
    }
