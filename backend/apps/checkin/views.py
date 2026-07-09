from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.generics import get_object_or_404
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import HasModulePermission, require_permission
from apps.orders.models import WorkOrder

from . import services
from .models import (
    ItemStatus,
    VehicleCheckIn,
    VehicleCheckInBelonging,
    VehicleCheckInItem,
    VehicleCheckInPhoto,
    VehicleDamage,
    VehicleDamagePhoto,
)
from .serializers import (
    BelongingSerializer,
    CheckInSerializer,
    DamageSerializer,
)

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


def _validate_upload(upload):
    if upload is None:
        raise ValidationError({"file": ["Envie um arquivo."]})
    if upload.size > MAX_UPLOAD_BYTES:
        raise ValidationError({"file": ["O arquivo excede o limite de 10 MB."]})
    ct = upload.content_type or ""
    if not (ct.startswith("image/") or ct == "application/pdf"):
        raise ValidationError({"file": ["Tipo inválido. Envie uma imagem."]})
    return ct


def _guard_editable(check_in):
    if check_in.is_locked:
        raise ValidationError(
            {
                "detail": "O check-in está concluído. Reabra para editar.",
                "code": "locked",
            }
        )


def _serialize(check_in, request):
    return CheckInSerializer(check_in, context={"request": request}).data


class WorkOrderCheckInView(APIView):
    """GET/POST do check-in de uma OS (`/api/work-orders/{id}/check-in/`)."""

    def get_permissions(self):
        code = "checkin.view" if self.request.method == "GET" else "checkin.edit"
        return [require_permission(code)()]

    def get(self, request, pk):
        order = get_object_or_404(WorkOrder, pk=pk)
        check_in = getattr(order, "check_in", None)
        if check_in is None:
            return Response(
                {"detail": "Check-in ainda não iniciado."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(_serialize(check_in, request))

    def post(self, request, pk):
        order = get_object_or_404(WorkOrder, pk=pk)
        check_in, created = services.get_or_create_check_in(order, request.user)
        if created:
            services.audit(request, "checkin.started", check_in)
        return Response(
            _serialize(check_in, request),
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class CheckInViewSet(
    mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet
):
    """Dados gerais do check-in + ações (`/api/check-ins/{id}/`)."""

    queryset = VehicleCheckIn.objects.all()
    serializer_class = CheckInSerializer
    permission_classes = [HasModulePermission]
    permission_module = "checkin"
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    permission_action_map = {
        "complete": "complete",
        "reopen": "reopen",
        "set_items": "edit",
        "add_photo": "edit",
        "add_belonging": "edit",
    }

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    def perform_update(self, serializer):
        _guard_editable(serializer.instance)
        check_in = serializer.save(
            updated_by=self.request.user if self.request.user.is_authenticated else None
        )
        services.audit(self.request, "checkin.updated", check_in)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        check_in = self.get_object()
        if check_in.status == "completed":
            raise ValidationError({"detail": "O check-in já está concluído."})
        if not check_in.damages.exists() and not check_in.photos.exists():
            # Não obriga, mas evita concluir um check-in vazio por engano.
            if not request.data.get("confirm_empty"):
                raise ValidationError(
                    {"detail": "Nenhuma avaria ou foto registrada.", "code": "empty"}
                )
        services.complete(check_in, request.user)
        services.audit(request, "checkin.completed", check_in)
        return Response(_serialize(check_in, request))

    @action(detail=True, methods=["post"])
    def reopen(self, request, pk=None):
        check_in = self.get_object()
        services.reopen(check_in, request.user)
        services.audit(request, "checkin.reopened", check_in)
        return Response(_serialize(check_in, request))

    @action(detail=True, methods=["patch"], url_path="items")
    def set_items(self, request, pk=None):
        check_in = self.get_object()
        _guard_editable(check_in)
        valid_status = {c for c, _ in ItemStatus.choices}
        for row in request.data.get("items", []):
            item = VehicleCheckInItem.objects.filter(
                pk=row.get("id"), check_in=check_in
            ).first()
            if item is None:
                continue
            if row.get("status") in valid_status:
                item.status = row["status"]
            if "notes" in row:
                item.notes = (row.get("notes") or "")[:200]
            item.save(update_fields=["status", "notes"])
        services.touch(check_in, request.user)
        return Response(_serialize(check_in, request))

    @action(detail=True, methods=["post"], url_path="photos")
    def add_photo(self, request, pk=None):
        check_in = self.get_object()
        _guard_editable(check_in)
        upload = request.FILES.get("file")
        _validate_upload(upload)
        from .models import PhotoCategory

        category = request.data.get("category")
        if category not in PhotoCategory.values:
            category = PhotoCategory.OTHER
        VehicleCheckInPhoto.objects.create(
            check_in=check_in,
            file=upload,
            category=category,
            caption=(request.data.get("caption") or "")[:200],
            created_by=request.user if request.user.is_authenticated else None,
        )
        services.touch(check_in, request.user)
        services.audit(request, "checkin.photo_added", check_in)
        return Response(_serialize(check_in, request), status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="belongings")
    def add_belonging(self, request, pk=None):
        check_in = self.get_object()
        _guard_editable(check_in)
        serializer = BelongingSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        photo = request.FILES.get("photo")
        if photo is not None:
            _validate_upload(photo)
        serializer.save(check_in=check_in, photo=photo)
        services.touch(check_in, request.user)
        services.audit(request, "checkin.belonging_added", check_in)
        return Response(_serialize(check_in, request), status=status.HTTP_201_CREATED)


class DamageViewSet(
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Avarias (`/api/check-in-damages/`)."""

    queryset = VehicleDamage.objects.select_related("check_in").all()
    serializer_class = DamageSerializer
    permission_classes = [HasModulePermission]
    permission_module = "checkin"
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    permission_action_map = {
        "create": "edit",
        "update": "edit",
        "partial_update": "edit",
        "destroy": "edit",
        "add_photo": "edit",
    }

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    def _check_in(self, data):
        check_in = get_object_or_404(VehicleCheckIn, pk=data.get("check_in"))
        return check_in

    def create(self, request, *args, **kwargs):
        check_in = self._check_in(request.data)
        _guard_editable(check_in)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(
            check_in=check_in,
            sequence=services.next_damage_sequence(check_in),
            created_by=request.user if request.user.is_authenticated else None,
        )
        services.touch(check_in, request.user)
        services.audit(
            request, "checkin.damage_added", check_in, damage=serializer.instance.id
        )
        return Response(_serialize(check_in, request), status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        damage = self.get_object()
        _guard_editable(damage.check_in)
        serializer = self.get_serializer(damage, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        services.touch(damage.check_in, request.user)
        services.audit(
            request, "checkin.damage_updated", damage.check_in, damage=damage.id
        )
        return Response(_serialize(damage.check_in, request))

    def destroy(self, request, *args, **kwargs):
        damage = self.get_object()
        _guard_editable(damage.check_in)
        check_in = damage.check_in
        damage_id = damage.id
        damage.delete()
        services.touch(check_in, request.user)
        services.audit(request, "checkin.damage_removed", check_in, damage=damage_id)
        return Response(_serialize(check_in, request))

    @action(detail=True, methods=["post"], url_path="photos")
    def add_photo(self, request, pk=None):
        damage = self.get_object()
        _guard_editable(damage.check_in)
        upload = request.FILES.get("file")
        _validate_upload(upload)
        VehicleDamagePhoto.objects.create(
            damage=damage,
            file=upload,
            caption=(request.data.get("caption") or "")[:200],
            created_by=request.user if request.user.is_authenticated else None,
        )
        services.touch(damage.check_in, request.user)
        services.audit(
            request, "checkin.photo_added", damage.check_in, damage=damage.id
        )
        return Response(
            _serialize(damage.check_in, request), status=status.HTTP_201_CREATED
        )


class _CheckInChildDeleteView(APIView):
    """Base para excluir filhos do check-in (foto/objeto), gated por checkin.edit."""

    model = None

    def get_permissions(self):
        return [require_permission("checkin.edit")()]

    def _check_in_of(self, obj):
        raise NotImplementedError

    def delete(self, request, pk):
        obj = get_object_or_404(self.model, pk=pk)
        check_in = self._check_in_of(obj)
        if check_in.is_locked:
            raise PermissionDenied("O check-in está concluído. Reabra para editar.")
        obj.delete()
        services.touch(check_in, request.user)
        services.audit(request, self.audit_action, check_in)
        return Response(_serialize(check_in, request))


class CheckInPhotoDeleteView(_CheckInChildDeleteView):
    model = VehicleCheckInPhoto
    audit_action = "checkin.photo_removed"

    def _check_in_of(self, obj):
        return obj.check_in


class DamagePhotoDeleteView(_CheckInChildDeleteView):
    model = VehicleDamagePhoto
    audit_action = "checkin.photo_removed"

    def _check_in_of(self, obj):
        return obj.damage.check_in


class BelongingDeleteView(_CheckInChildDeleteView):
    model = VehicleCheckInBelonging
    audit_action = "checkin.belonging_removed"

    def _check_in_of(self, obj):
        return obj.check_in
