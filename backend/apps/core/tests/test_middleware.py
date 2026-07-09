"""Testes do OriginCheckMiddleware (defesa anti-CSRF por Origin/Referer)."""

from django.http import HttpResponse
from django.test import RequestFactory, override_settings

from apps.core.middleware import OriginCheckMiddleware

rf = RequestFactory()


def _mw():
    return OriginCheckMiddleware(lambda request: HttpResponse("ok"))


@override_settings(
    CORS_ALLOWED_ORIGINS=["http://localhost:5173"], FRONTEND_URL="http://localhost:5173"
)
def test_blocks_unsafe_request_from_foreign_origin():
    mw = _mw()
    resp = mw(rf.post("/api/customers/", HTTP_ORIGIN="http://evil.example"))
    assert resp.status_code == 403


@override_settings(
    CORS_ALLOWED_ORIGINS=["http://localhost:5173"], FRONTEND_URL="http://localhost:5173"
)
def test_allows_unsafe_request_from_permitted_origin():
    mw = _mw()
    resp = mw(rf.post("/api/customers/", HTTP_ORIGIN="http://localhost:5173"))
    assert resp.status_code == 200


@override_settings(
    CORS_ALLOWED_ORIGINS=["http://localhost:5173"], FRONTEND_URL="http://localhost:5173"
)
def test_allows_unsafe_request_without_origin_or_referer():
    # curl/testes/server-to-server não enviam Origin -> liberado.
    mw = _mw()
    resp = mw(rf.post("/api/customers/"))
    assert resp.status_code == 200


@override_settings(
    CORS_ALLOWED_ORIGINS=["http://localhost:5173"], FRONTEND_URL="http://localhost:5173"
)
def test_ignores_safe_methods_and_non_api_paths():
    mw = _mw()
    assert (
        mw(rf.get("/api/customers/", HTTP_ORIGIN="http://evil.example")).status_code
        == 200
    )
    assert (
        mw(rf.post("/admin/login/", HTTP_ORIGIN="http://evil.example")).status_code
        == 200
    )


@override_settings(
    CORS_ALLOWED_ORIGINS=["http://localhost:5173"], FRONTEND_URL="http://localhost:5173"
)
def test_falls_back_to_referer_when_no_origin():
    mw = _mw()
    ok = mw(rf.post("/api/customers/", HTTP_REFERER="http://localhost:5173/customers"))
    assert ok.status_code == 200
    bad = mw(rf.post("/api/customers/", HTTP_REFERER="http://evil.example/x"))
    assert bad.status_code == 403
