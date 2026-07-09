from django.db.models import Q
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.audit import record_audit
from apps.accounts.permissions import HasModulePermission, require_permission

from .models import (
    Notification,
    NotificationPreference,
    NotificationRule,
    NotifStatus,
    NotifType,
)
from .serializers import (
    ManualNotificationSerializer,
    NotificationPreferenceSerializer,
    NotificationRuleSerializer,
    NotificationSerializer,
)
from .services import archive, create_manual, mark_read, mark_unread, unread_count


class NotificationViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Central de Notificações do usuário logado (só as próprias)."""

    serializer_class = NotificationSerializer
    permission_classes = [HasModulePermission]
    permission_module = "alerts"
    permission_action_map = {
        "unread_count": "view",
        "read": "view",
        "unread": "view",
        "mark_all_read": "view",
        "mark_read_bulk": "view",
        "archive": "view",
        "manual": "send_manual",
    }

    def get_queryset(self):
        user = self.request.user
        qs = Notification.objects.filter(recipient=user).select_related("audience_role")
        # Esconde expiradas.
        qs = qs.filter(Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now()))

        p = self.request.query_params
        status_filter = p.get("status")
        if status_filter in {
            NotifStatus.UNREAD,
            NotifStatus.READ,
            NotifStatus.ARCHIVED,
        }:
            qs = qs.filter(status=status_filter)
        elif status_filter == "all":
            pass
        else:
            # Padrão: não mostra arquivadas.
            qs = qs.exclude(status=NotifStatus.ARCHIVED)

        if p.get("module"):
            qs = qs.filter(module=p["module"])
        if p.get("priority"):
            qs = qs.filter(priority=p["priority"])
        if p.get("notif_type"):
            qs = qs.filter(notif_type=p["notif_type"])
        if p.get("date_from"):
            qs = qs.filter(created_at__date__gte=p["date_from"])
        if p.get("date_to"):
            qs = qs.filter(created_at__date__lte=p["date_to"])
        search = (p.get("q") or "").strip()
        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(message__icontains=search)
                | Q(detail__icontains=search)
            )
        return qs

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        limit = request.query_params.get("limit")
        if limit and limit.isdigit():
            qs = qs[: int(limit)]
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        return Response({"count": unread_count(request.user)})

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        notif = self.get_object()
        mark_read(request.user, ids=[notif.id])
        notif.refresh_from_db()
        return Response(NotificationSerializer(notif).data)

    @action(detail=True, methods=["post"])
    def unread(self, request, pk=None):
        notif = self.get_object()
        mark_unread(notif)
        return Response(NotificationSerializer(notif).data)

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        updated = mark_read(request.user)
        return Response({"updated": updated})

    @action(detail=False, methods=["post"], url_path="mark-read")
    def mark_read_bulk(self, request):
        ids = request.data.get("ids")
        if not isinstance(ids, list) or not ids:
            return Response(
                {"detail": "Informe os ids."}, status=status.HTTP_400_BAD_REQUEST
            )
        updated = mark_read(request.user, ids=ids)
        return Response({"updated": updated})

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        notif = self.get_object()
        archive(notif)
        return Response(NotificationSerializer(notif).data)

    @action(detail=False, methods=["post"])
    def manual(self, request):
        serializer = ManualNotificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        created = create_manual(
            created_by=request.user,
            recipient_ids=data.get("recipient_ids"),
            role_key=(data.get("role_key") or "").strip() or None,
            title=data["title"],
            message=data["message"],
            detail=data.get("detail", ""),
            priority=data["priority"],
            url=data.get("url", ""),
            expires_at=data.get("expires_at"),
        )
        record_audit(
            request,
            "alert.manual_sent",
            new_value={"recipients": len(created), "title": data["title"]},
        )
        return Response({"created": len(created)}, status=status.HTTP_201_CREATED)


class NotificationRuleView(APIView):
    """Configuração dos avisos (por tipo). GET=alerts.view, PATCH=alerts.configure."""

    def get_permissions(self):
        code = "alerts.configure" if self.request.method == "PATCH" else "alerts.view"
        return [require_permission(code)()]

    def get(self, request):
        # Garante uma regra para cada tipo conhecido.
        for value, _ in NotifType.choices:
            NotificationRule.get_for(value)
        rules = NotificationRule.objects.all()
        return Response(NotificationRuleSerializer(rules, many=True).data)

    def patch(self, request):
        items = request.data if isinstance(request.data, list) else [request.data]
        updated = []
        for item in items:
            notif_type = item.get("notif_type")
            if not notif_type:
                continue
            rule = NotificationRule.get_for(notif_type)
            serializer = NotificationRuleSerializer(rule, data=item, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save(updated_by=request.user)
            updated.append(serializer.data)
        record_audit(request, "alert.rules_updated", new_value={"count": len(updated)})
        return Response(updated)


class NotificationPreferenceView(APIView):
    """Preferências individuais do usuário logado."""

    permission_classes = [require_permission("alerts.view")]

    def get(self, request):
        pref = NotificationPreference.get_for(request.user)
        return Response(NotificationPreferenceSerializer(pref).data)

    def patch(self, request):
        pref = NotificationPreference.get_for(request.user)
        serializer = NotificationPreferenceSerializer(
            pref, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
