from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Category
from .serializers import DUPLICATE_NAME_MESSAGE, CategorySerializer


class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer

    def get_queryset(self):
        queryset = Category.objects.all()

        category_type = self.request.query_params.get("category_type")
        if category_type:
            queryset = queryset.filter(category_type=category_type)

        # The active/inactive status filter only makes sense for the listing
        # -- detail routes (retrieve/update/destroy/reactivate) must be able
        # to find a category regardless of its current state, otherwise an
        # inactive category could never be fetched to edit or reactivate.
        if self.action != "list":
            return queryset

        status_param = self.request.query_params.get("status", "active")
        if status_param == "active":
            queryset = queryset.filter(is_active=True)
        elif status_param == "inactive":
            queryset = queryset.filter(is_active=False)
        # "all" (or anything else) returns every category, active or not.
        return queryset

    def destroy(self, request, *args, **kwargs):
        category = self.get_object()
        category.is_active = False
        category.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def reactivate(self, request, pk=None):
        category = self.get_object()
        if Category.has_active_conflict(
            category.category_type, category.name, exclude_pk=category.pk
        ):
            return Response(
                {"name": [DUPLICATE_NAME_MESSAGE]}, status=status.HTTP_400_BAD_REQUEST
            )
        category.is_active = True
        category.save(update_fields=["is_active", "updated_at"])
        return Response(CategorySerializer(category).data)
