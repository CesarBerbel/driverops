"""Paginação opt-in para as listagens do DRF.

O frontend atual consome listas como arrays crus. Para não quebrar isso num
big-bang, esta paginação é **sob demanda**: sem o parâmetro ``page`` a resposta
continua sendo a lista completa (comportamento histórico); com ``?page=N`` (e,
opcionalmente, ``?page_size=``) a resposta vira o envelope paginado
``{count, next, previous, results}``. Assim cada endpoint fica paginável quando
o cliente quiser, e o frontend pode adotar página a página sem rupturas.
"""

from rest_framework.pagination import PageNumberPagination


class OptionalPageNumberPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200

    def paginate_queryset(self, queryset, request, view=None):
        # Sem ?page -> não pagina (DRF devolve a lista inteira, como hoje).
        if self.page_query_param not in request.query_params:
            return None
        return super().paginate_queryset(queryset, request, view)
