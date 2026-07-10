"""Paginação limitada (fail-safe) para as listagens do DRF.

Toda listagem é **sempre limitada** -- nenhum endpoint devolve uma resposta
ilimitada, protegendo o servidor de varreduras/DoS e de respostas gigantes.

- Com ``?page=N`` (e opcionalmente ``?page_size=``, até ``max_page_size``): o
  envelope paginado padrão ``{count, next, previous, results}``.
- Sem ``?page``: a resposta é a lista, mas **cortada em ``max_page_size``** e
  devolvida como array cru (mantém a compatibilidade com o frontend, que lê
  arrays), com o cabeçalho ``X-Result-Limit`` avisando o teto aplicado. Para ver
  além do teto, o cliente pagina com ``?page``.
"""

from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class OptionalPageNumberPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200

    def paginate_queryset(self, queryset, request, view=None):
        self._bounded = self.page_query_param not in request.query_params
        if not self._bounded:
            return super().paginate_queryset(queryset, request, view)
        # Sem ?page: nunca ilimitado -- corta no teto e devolve como array.
        return list(queryset[: self.max_page_size])

    def get_paginated_response(self, data):
        if getattr(self, "_bounded", False):
            response = Response(data)
            response["X-Result-Limit"] = str(self.max_page_size)
            return response
        return super().get_paginated_response(data)
