from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .audit import record_audit
from .emails import send_password_reset_email
from .models import AuditLog, Permission, Role, UserPermission
from .permissions import IsSuperUser, require_permission
from .rbac import module_labels
from .rbac_serializers import (
    AuditLogSerializer,
    PermissionSerializer,
    RoleSerializer,
    UserAdminSerializer,
)

User = get_user_model()


def _active_superuser_count(exclude_id=None):
    qs = User.objects.filter(is_active=True, is_superuser=True)
    if exclude_id:
        qs = qs.exclude(pk=exclude_id)
    return qs.count()


def _active_admin_count(exclude_id=None):
    qs = User.objects.filter(is_active=True).filter(
        Q(is_superuser=True) | Q(role__key="administrador")
    )
    if exclude_id:
        qs = qs.exclude(pk=exclude_id)
    return qs.count()


class UserViewSet(viewsets.ModelViewSet):
    """CRUD de usuários (gerenciamento). Exige a permissão ``users.manage``."""

    serializer_class = UserAdminSerializer
    permission_classes = [require_permission("users.manage")]

    def get_queryset(self):
        queryset = User.objects.select_related("role").all()
        # Detail routes (retrieve/update/reactivate/...) precisam achar o usuário
        # independentemente do status; os filtros valem só na listagem.
        if self.action != "list":
            return queryset
        params = self.request.query_params
        search = params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(full_name__icontains=search) | Q(email__icontains=search)
            )
        role = params.get("role")
        if role:
            queryset = queryset.filter(role__key=role)
        specialty = params.get("specialty")
        if specialty:
            queryset = queryset.filter(technical_specialty=specialty)
        status_param = params.get("status", "active")
        if status_param == "active":
            queryset = queryset.filter(is_active=True)
        elif status_param == "inactive":
            queryset = queryset.filter(is_active=False)
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        password = serializer.validated_data.pop("password", "")
        send_invite = serializer.validated_data.pop("send_invite", False)
        # Usuários criados pela tela nunca são superuser (regra de segurança).
        user = User(**serializer.validated_data)
        user.is_superuser = False
        user.is_staff = False
        if send_invite or not password:
            user.set_unusable_password()
            user.force_password_change = True
        else:
            user.set_password(password)
        user.save()
        if send_invite:
            send_password_reset_email(user)
        record_audit(
            request,
            "user.create",
            target_user=user,
            new_value={
                "email": user.email,
                "role": user.role.key if user.role else None,
            },
        )
        return Response(self.get_serializer(user).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        old = {
            "role": user.role.key if user.role else None,
            "is_active": user.is_active,
        }
        # Não é possível desativar o superuser por esta via nem alterá-lo para
        # não-superuser; a desativação passa pelas regras do destroy.
        if user.is_superuser and request.data.get("is_active") is False:
            return Response(
                {"detail": "Não é possível desativar um superuser por aqui."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        response = super().update(request, *args, **kwargs)
        user.refresh_from_db()
        record_audit(
            request,
            "user.update",
            target_user=user,
            old_value=old,
            new_value={
                "role": user.role.key if user.role else None,
                "is_active": user.is_active,
            },
        )
        return response

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        blocked = self._deactivation_guard(request, user)
        if blocked:
            return blocked
        user.is_active = False
        user.save(update_fields=["is_active"])
        record_audit(request, "user.deactivate", target_user=user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _deactivation_guard(self, request, user):
        if user.id == request.user.id:
            return Response(
                {"detail": "Você não pode desativar o próprio usuário."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if user.is_superuser and _active_superuser_count(exclude_id=user.id) == 0:
            return Response(
                {"detail": "Não é possível desativar o último superuser."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if _active_admin_count(exclude_id=user.id) == 0:
            return Response(
                {"detail": "Não é possível desativar o último usuário administrativo."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return None

    @action(detail=True, methods=["post"])
    def reactivate(self, request, pk=None):
        user = self.get_object()
        user.is_active = True
        user.save(update_fields=["is_active"])
        record_audit(request, "user.reactivate", target_user=user)
        return Response(self.get_serializer(user).data)

    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        user = self.get_object()
        password = request.data.get("password") or ""
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.force_password_change = True
        user.save()
        if not password:
            send_password_reset_email(user)
        record_audit(request, "user.reset_password", target_user=user)
        return Response(self.get_serializer(user).data)

    @action(detail=True, methods=["post"], url_path="force-password-change")
    def force_password_change_action(self, request, pk=None):
        user = self.get_object()
        user.force_password_change = True
        user.save(update_fields=["force_password_change"])
        record_audit(request, "user.force_password_change", target_user=user)
        return Response(self.get_serializer(user).data)


class RoleListView(ListAPIView):
    """Lista os perfis (leitura para usuários autenticados)."""

    permission_classes = [IsAuthenticated]
    serializer_class = RoleSerializer
    queryset = Role.objects.prefetch_related("permissions").all()
    pagination_class = None


class PermissionCatalogView(APIView):
    """Catálogo de permissões agrupado por módulo (para a matriz). Só superuser."""

    permission_classes = [require_permission("permissions.manage")]

    def get(self, request):
        labels = module_labels()
        grouped = {}
        for perm in Permission.objects.all():
            grouped.setdefault(perm.module, []).append(PermissionSerializer(perm).data)
        modules = [
            {
                "module": module,
                "label": labels.get(module, module),
                "permissions": perms,
            }
            for module, perms in grouped.items()
        ]
        return Response({"modules": modules})


class UserPermissionsView(APIView):
    """Permissões de um usuário: herdadas do perfil vs concedidas/removidas.

    Tela **exclusiva do superuser** (permissão ``permissions.manage``).
    """

    permission_classes = [require_permission("permissions.manage")]

    def _user(self, pk):
        return User.objects.select_related("role").get(pk=pk)

    def get(self, request, pk):
        try:
            user = self._user(pk)
        except User.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        inherited = set()
        if user.role_id:
            inherited = set(user.role.permissions.values_list("codename", flat=True))
        overrides = {
            o.permission.codename: o.grant_type
            for o in user.permission_overrides.select_related("permission")
        }
        effective = user.effective_permission_codes()
        labels = module_labels()
        grouped = {}
        for perm in Permission.objects.all():
            grouped.setdefault(perm.module, []).append(
                {
                    "codename": perm.codename,
                    "action": perm.action,
                    "label": perm.label,
                    "is_critical": perm.is_critical,
                    "inherited": perm.codename in inherited,
                    "granted": overrides.get(perm.codename) == "grant",
                    "revoked": overrides.get(perm.codename) == "revoke",
                    "effective": user.is_superuser or perm.codename in effective,
                }
            )
        modules = [
            {"module": m, "label": labels.get(m, m), "permissions": p}
            for m, p in grouped.items()
        ]
        return Response(
            {
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "full_name": user.full_name,
                    "role_key": user.role.key if user.role else None,
                    "role_name": user.role.name if user.role else None,
                    "is_superuser": user.is_superuser,
                },
                "modules": modules,
            }
        )

    def put(self, request, pk):
        try:
            user = self._user(pk)
        except User.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if user.is_superuser:
            return Response(
                {"detail": "O superuser já possui acesso total; nada a ajustar."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        granted = set(request.data.get("granted", []))
        revoked = set(request.data.get("revoked", []))
        valid = set(Permission.objects.values_list("codename", flat=True))
        unknown = (granted | revoked) - valid
        if unknown:
            return Response(
                {"detail": f"Permissões inválidas: {', '.join(sorted(unknown))}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        old = {
            o.permission.codename: o.grant_type
            for o in user.permission_overrides.select_related("permission")
        }
        perms_by_code = {p.codename: p for p in Permission.objects.all()}
        user.permission_overrides.all().delete()
        overrides = [
            UserPermission(user=user, permission=perms_by_code[c], grant_type="grant")
            for c in granted
        ] + [
            UserPermission(user=user, permission=perms_by_code[c], grant_type="revoke")
            for c in revoked - granted
        ]
        UserPermission.objects.bulk_create(overrides)
        record_audit(
            request,
            "permission.set",
            target_user=user,
            old_value=old,
            new_value={
                **{c: "grant" for c in granted},
                **{c: "revoke" for c in revoked - granted},
            },
        )
        return self.get(request, pk)


class AuditLogListView(ListAPIView):
    """Trilha de auditoria (leitura). Exige a permissão ``audit.view``."""

    permission_classes = [require_permission("audit.view")]
    serializer_class = AuditLogSerializer
    pagination_class = None

    def get_queryset(self):
        queryset = AuditLog.objects.select_related("actor", "target_user").all()
        target = self.request.query_params.get("target_user")
        if target:
            queryset = queryset.filter(target_user_id=target)
        return queryset[:200]


# Reexport para manter compatibilidade caso algo importe IsSuperUser daqui.
__all__ = [
    "UserViewSet",
    "RoleListView",
    "PermissionCatalogView",
    "UserPermissionsView",
    "AuditLogListView",
    "IsSuperUser",
]
