import pytest

pytestmark = pytest.mark.django_db


def test_login_success_sets_cookies_and_returns_user(client, user):
    response = client.post(
        "/api/auth/login/",
        data={"email": user.email, "password": "StrongPass123"},
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response.data["user"]["email"] == user.email
    assert "access_token" in response.cookies
    assert response.cookies["access_token"]["httponly"]
    assert "refresh_token" in response.cookies


def test_login_wrong_password_returns_401(client, user):
    response = client.post(
        "/api/auth/login/",
        data={"email": user.email, "password": "wrong-password"},
        content_type="application/json",
    )

    assert response.status_code == 401


def test_me_requires_authentication(client):
    response = client.get("/api/users/me/")
    assert response.status_code == 401


def test_me_returns_current_user_when_authenticated(auth_client, user):
    response = auth_client.get("/api/users/me/")
    assert response.status_code == 200
    assert response.data["email"] == user.email


def test_refresh_with_valid_cookie_issues_new_access_cookie(auth_client):
    old_access = auth_client.cookies["access_token"].value

    response = auth_client.post("/api/auth/refresh/")

    assert response.status_code == 204
    assert response.cookies["access_token"].value != old_access


def test_refresh_without_cookie_returns_401(client):
    response = client.post("/api/auth/refresh/")
    assert response.status_code == 401


def test_rotated_refresh_token_is_revoked(auth_client):
    """Regressão de segurança: com BLACKLIST_AFTER_ROTATION, o refresh token
    antigo é invalidado a cada rotação. Reutilizar o token pré-rotação falha
    (401) -- é isto que faz o logout realmente encerrar a sessão (nenhum token
    rotacionado sobrevive para gerar novos access tokens)."""
    original_refresh = auth_client.cookies["refresh_token"].value

    first = auth_client.post("/api/auth/refresh/")
    assert first.status_code == 204
    assert auth_client.cookies["refresh_token"].value != original_refresh

    # Reusar o refresh token antigo (rotacionado) -> revogado -> 401.
    auth_client.cookies["refresh_token"] = original_refresh
    second = auth_client.post("/api/auth/refresh/")
    assert second.status_code == 401


def test_logout_clears_cookies_and_revokes_refresh(auth_client):
    refresh_at_logout = auth_client.cookies["refresh_token"].value

    response = auth_client.post("/api/auth/logout/")
    assert response.status_code == 204
    assert response.cookies["access_token"].value == ""
    assert response.cookies["refresh_token"].value == ""

    me_response = auth_client.get("/api/users/me/")
    assert me_response.status_code == 401

    # O refresh token do logout foi para a blacklist: não gera novo access.
    auth_client.cookies["refresh_token"] = refresh_at_logout
    reuse = auth_client.post("/api/auth/refresh/")
    assert reuse.status_code == 401


def test_logout_revokes_refresh_with_a_real_cookie_jar(live_server, user):
    """Regressão do PATH do cookie de refresh, com um cookie jar REAL.

    O test client do Django ignora o atributo Path dos cookies (envia todos em
    toda requisição), então mascarava um bug: se o cookie de refresh não cobrir a
    rota de logout, o navegador não o envia no logout e o token nunca vai para a
    blacklist. Aqui usamos ``requests.Session`` (jar real, que respeita Path):
    login + logout na mesma sessão e, então, provamos que o token capturado ANTES
    do logout está revogado.
    """
    import requests
    from django.core.cache import cache

    cache.clear()  # zera o throttle de login (compartilhado por IP entre testes)
    base = live_server.url
    session = requests.Session()

    login = session.post(
        f"{base}/api/auth/login/",
        json={"email": user.email, "password": "StrongPass123"},
    )
    assert login.status_code == 200, login.text
    captured_refresh = session.cookies.get("refresh_token")
    assert captured_refresh

    # Logout na MESMA sessão: o jar só envia o refresh ao /api/auth/logout/ se o
    # Path do cookie cobrir essa rota. Se não cobrir, o logout não revoga nada.
    logout = session.post(f"{base}/api/auth/logout/")
    assert logout.status_code == 204

    # O token capturado antes do logout tem de estar na blacklist -> 401. Se o
    # Path estivesse errado, o logout não teria revogado e isto daria 204.
    reuse = requests.post(
        f"{base}/api/auth/refresh/", cookies={"refresh_token": captured_refresh}
    )
    assert reuse.status_code == 401


def test_login_is_throttled_after_repeated_failures(client, user):
    # Matches the "login": "5/min" DEFAULT_THROTTLE_RATES configured in settings/base.py.
    for _ in range(5):
        client.post(
            "/api/auth/login/",
            data={"email": user.email, "password": "wrong-password"},
            content_type="application/json",
        )

    response = client.post(
        "/api/auth/login/",
        data={"email": user.email, "password": "wrong-password"},
        content_type="application/json",
    )
    assert response.status_code == 429
