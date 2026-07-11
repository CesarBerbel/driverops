import logging

from rest_framework import status as http_status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.audit import record_audit
from apps.accounts.permissions import require_permission

from .models import RecentSearch, SavedSearch, SmartSearchSettings
from .serializers import (
    RecentSearchSerializer,
    SavedSearchSerializer,
    SearchRequestSerializer,
    SmartSearchSettingsSerializer,
)
from .services import run_search

logger = logging.getLogger(__name__)


# Sugestões iniciais (empty state) -- ações comuns em linguagem natural.
STARTER_SUGGESTIONS = [
    "OS aguardando aprovação",
    "OS do ano passado com revisão completa",
    "Carros com problema no freio",
    "Clientes com troca de óleo nos últimos 6 meses",
    "Veículos com diagnóstico de falha elétrica",
    "Pedidos do site novos",
]


class SmartSearchView(APIView):
    """POST /api/search/smart -- busca inteligente global.

    Requer apenas autenticação; cada entidade é filtrada por permissão dentro do
    executor, de forma que o usuário só recebe o que pode ver.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "smart_search"

    def post(self, request):
        serializer = SearchRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        query = serializer.validated_data["query"].strip()
        if not query:
            return Response(
                {"detail": "Digite o que deseja encontrar."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        conf = SmartSearchSettings.get_solo()
        limit = serializer.validated_data.get("limit") or conf.result_limit
        payload = run_search(query, user=request.user, settings_obj=conf, limit=limit)
        return Response(payload)


class RecentSearchView(APIView):
    """GET lista as buscas recentes do usuário; DELETE limpa o histórico."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = RecentSearch.objects.filter(user=request.user)[:10]
        return Response(RecentSearchSerializer(qs, many=True).data)

    def delete(self, request):
        RecentSearch.objects.filter(user=request.user).delete()
        return Response(status=http_status.HTTP_204_NO_CONTENT)


class SavedSearchView(APIView):
    """GET lista pesquisas salvas do usuário; POST cria uma nova."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = SavedSearch.objects.filter(user=request.user)
        return Response(SavedSearchSerializer(qs, many=True).data)

    def post(self, request):
        serializer = SavedSearchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response(serializer.data, status=http_status.HTTP_201_CREATED)


class SavedSearchDetailView(APIView):
    """DELETE remove uma pesquisa salva do usuário."""

    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        deleted, _ = SavedSearch.objects.filter(user=request.user, pk=pk).delete()
        if not deleted:
            return Response(status=http_status.HTTP_404_NOT_FOUND)
        return Response(status=http_status.HTTP_204_NO_CONTENT)


class SearchSuggestionsView(APIView):
    """GET sugestões iniciais + pesquisas salvas do usuário (para o empty state)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        saved = SavedSearch.objects.filter(user=request.user)[:8]
        return Response(
            {
                "starters": STARTER_SUGGESTIONS,
                "saved": SavedSearchSerializer(saved, many=True).data,
            }
        )


class SmartSearchSettingsView(APIView):
    """GET/PATCH da configuração administrativa da Busca Inteligente."""

    def get_permissions(self):
        if self.request.method == "PATCH":
            return [require_permission("settings.edit")()]
        return [require_permission("settings.view")()]

    def get(self, request):
        conf = SmartSearchSettings.get_solo()
        return Response(SmartSearchSettingsSerializer(conf).data)

    def patch(self, request):
        conf = SmartSearchSettings.get_solo()
        serializer = SmartSearchSettingsSerializer(
            conf, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.user)
        record_audit(request, "smart_search.settings.update", new_value=serializer.data)
        return Response(serializer.data)
