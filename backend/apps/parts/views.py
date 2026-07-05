from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import HasModulePermission

from .models import Part
from .serializers import PartSerializer


class PartViewSet(viewsets.ModelViewSet):
    serializer_class = PartSerializer
    permission_classes = [HasModulePermission]
    permission_module = "parts"

    def get_queryset(self):
        queryset = Part.objects.select_related("category", "supplier").all()

        category_id = self.request.query_params.get("category")
        if category_id:
            queryset = queryset.filter(category_id=category_id)

        if self.action != "list":
            return queryset

        status_param = self.request.query_params.get("status", "active")
        if status_param == "active":
            queryset = queryset.filter(is_active=True)
        elif status_param == "inactive":
            queryset = queryset.filter(is_active=False)

        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(internal_code__icontains=search)
                | Q(brand__icontains=search)
                | Q(category__name__icontains=search)
            )
        return queryset

    def destroy(self, request, *args, **kwargs):
        part = self.get_object()
        part.is_active = False
        part.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def reactivate(self, request, pk=None):
        part = self.get_object()
        part.is_active = True
        part.save(update_fields=["is_active", "updated_at"])
        return Response(PartSerializer(part).data)
