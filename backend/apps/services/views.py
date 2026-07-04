from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Service, ServicePackage
from .serializers import ServicePackageSerializer, ServiceSerializer


class ServiceViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceSerializer

    def get_queryset(self):
        queryset = Service.objects.select_related("category").prefetch_related(
            "standard_parts__part"
        )

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
                Q(name__icontains=search) | Q(category__name__icontains=search)
            )
        return queryset

    def destroy(self, request, *args, **kwargs):
        service = self.get_object()
        service.is_active = False
        service.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def reactivate(self, request, pk=None):
        service = self.get_object()
        service.is_active = True
        service.save(update_fields=["is_active", "updated_at"])
        return Response(ServiceSerializer(service).data)


class ServicePackageViewSet(viewsets.ModelViewSet):
    serializer_class = ServicePackageSerializer

    def get_queryset(self):
        queryset = ServicePackage.objects.prefetch_related(
            "items__service__standard_parts__part"
        )

        if self.action != "list":
            return queryset

        status_param = self.request.query_params.get("status", "active")
        if status_param == "active":
            queryset = queryset.filter(is_active=True)
        elif status_param == "inactive":
            queryset = queryset.filter(is_active=False)

        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(Q(name__icontains=search))
        return queryset

    def destroy(self, request, *args, **kwargs):
        package = self.get_object()
        package.is_active = False
        package.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def reactivate(self, request, pk=None):
        package = self.get_object()
        package.is_active = True
        package.save(update_fields=["is_active", "updated_at"])
        return Response(ServicePackageSerializer(package).data)
