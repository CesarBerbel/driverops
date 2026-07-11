from datetime import date

from django.db.models import Q
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.audit import record_audit
from apps.accounts.permissions import HasModulePermission, require_permission

from . import ai, services
from .models import (
    OPEN_STATUSES,
    PRIORITY_ORDER,
    CampaignStatus,
    CrmCampaign,
    CrmSettings,
    CrmSuggestion,
    CrmTask,
    SuggestionStatus,
    TaskStatus,
)
from .serializers import (
    CampaignSerializer,
    SettingsSerializer,
    SuggestionSerializer,
    TaskSerializer,
)


class SuggestionViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = SuggestionSerializer
    permission_classes = [HasModulePermission]
    permission_module = "crm"
    permission_action_map = {
        "partial_update": "manage",
        "update": "manage",
        "approve": "manage",
        "set_status_action": "manage",
        "snooze": "manage",
        "complete": "manage",
        "dismiss": "dismiss",
        "assign": "manage",
        "pending_count": "view",
        "generate_message": "use_ai",
        "mark_sent": "send_message",
        "to_task": "assign_task",
        "to_campaign": "create_campaign",
    }

    def get_queryset(self):
        qs = CrmSuggestion.objects.select_related(
            "customer", "vehicle", "work_order", "quote", "assigned_to"
        ).prefetch_related("events")
        p = self.request.query_params
        if p.get("status"):
            qs = qs.filter(status=p["status"])
        elif p.get("open") == "1":
            qs = qs.filter(status__in=OPEN_STATUSES)
        if p.get("priority"):
            qs = qs.filter(priority=p["priority"])
        if p.get("category"):
            qs = qs.filter(category=p["category"])
        if p.get("suggestion_type"):
            qs = qs.filter(suggestion_type=p["suggestion_type"])
        if p.get("customer"):
            qs = qs.filter(customer_id=p["customer"])
        if p.get("work_order"):
            qs = qs.filter(work_order_id=p["work_order"])
        if p.get("quote"):
            qs = qs.filter(quote_id=p["quote"])
        search = (p.get("q") or "").strip()
        if search:
            qs = qs.filter(
                Q(reason__icontains=search) | Q(customer__name__icontains=search)
            )
        return qs

    def list(self, request, *args, **kwargs):
        # Ordena por prioridade (urgente primeiro) e recência -- só na listagem,
        # para não quebrar get_object() das rotas de detalhe.
        items = sorted(
            self.get_queryset(),
            key=lambda s: (-PRIORITY_ORDER.get(s.priority, 0), -s.id),
        )
        # paginate_queryset (OptionalPageNumberPagination): sem ?page devolve um
        # array cortado em 200; com ?page devolve {count,next,previous,results}.
        page = self.paginate_queryset(items)
        return self.get_paginated_response(SuggestionSerializer(page, many=True).data)

    def perform_update(self, serializer):
        suggestion = serializer.save()
        record_audit(
            self.request, "crm.suggestion.edit", new_value={"suggestion": suggestion.id}
        )

    @action(detail=False, methods=["get"], url_path="pending-count")
    def pending_count(self, request):
        count = CrmSuggestion.objects.filter(status__in=OPEN_STATUSES).count()
        return Response({"count": count})

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        s = self.get_object()
        services.set_status(
            s,
            SuggestionStatus.IN_ANALYSIS,
            actor=request.user,
            description="Sugestão aprovada para ação.",
            request=request,
        )
        return Response(SuggestionSerializer(s).data)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        s = self.get_object()
        services.set_status(
            s, SuggestionStatus.COMPLETED, actor=request.user, request=request
        )
        return Response(SuggestionSerializer(s).data)

    @action(detail=True, methods=["post"])
    def dismiss(self, request, pk=None):
        s = self.get_object()
        services.set_status(
            s,
            SuggestionStatus.IGNORED,
            actor=request.user,
            description="Sugestão ignorada.",
            request=request,
        )
        return Response(SuggestionSerializer(s).data)

    @action(detail=True, methods=["post"], url_path="status")
    def set_status_action(self, request, pk=None):
        s = self.get_object()
        new_status = request.data.get("status")
        if new_status not in {c for c, _ in SuggestionStatus.choices}:
            return Response({"detail": "Status inválido."}, status=400)
        services.set_status(s, new_status, actor=request.user, request=request)
        return Response(SuggestionSerializer(s).data)

    @action(detail=True, methods=["post"])
    def snooze(self, request, pk=None):
        s = self.get_object()
        days = int(request.data.get("days") or 2)
        services.snooze(s, days, actor=request.user, request=request)
        return Response(SuggestionSerializer(s).data)

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        s = self.get_object()
        from django.contrib.auth import get_user_model

        user = get_user_model().objects.filter(pk=request.data.get("user")).first()
        s.assigned_to = user
        s.save(update_fields=["assigned_to", "updated_at"])
        services.record_event(
            s,
            f"Responsável: {(user.full_name or user.email) if user else 'removido'}.",
            actor=request.user,
        )
        return Response(SuggestionSerializer(s).data)

    @action(detail=True, methods=["post"], url_path="generate-message")
    def generate_message(self, request, pk=None):
        s = self.get_object()
        result = ai.generate_message(s, request.user)
        record_audit(
            request,
            "crm.suggestion.ai",
            new_value={"suggestion": s.id, "ai_used": result.get("ai_used")},
        )
        return Response(result)

    @action(detail=True, methods=["post"], url_path="mark-sent")
    def mark_sent(self, request, pk=None):
        s = self.get_object()
        channel = request.data.get("channel") or s.channel
        services.set_status(
            s,
            SuggestionStatus.SENT,
            actor=request.user,
            description=f"Mensagem enviada ({channel}).",
            request=request,
        )
        return Response(SuggestionSerializer(s).data)

    @action(detail=True, methods=["post"], url_path="to-task")
    def to_task(self, request, pk=None):
        s = self.get_object()
        task = services.to_task(
            s,
            actor=request.user,
            title=request.data.get("title", ""),
            due_date=request.data.get("due_date"),
            request=request,
        )
        return Response(TaskSerializer(task).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="to-campaign")
    def to_campaign(self, request, pk=None):
        s = self.get_object()
        campaign = services.to_campaign(
            s,
            actor=request.user,
            name=request.data.get("name", ""),
            segment_key=request.data.get("segment_key", ""),
            request=request,
        )
        return Response(
            CampaignSerializer(campaign).data, status=status.HTTP_201_CREATED
        )


class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [HasModulePermission]
    permission_module = "crm"
    permission_action_map = {
        "create": "assign_task",
        "update": "assign_task",
        "partial_update": "assign_task",
        "destroy": "assign_task",
        "pending_count": "view",
    }

    def get_queryset(self):
        qs = CrmTask.objects.select_related(
            "customer", "vehicle", "work_order", "quote", "assigned_to"
        )
        p = self.request.query_params
        if p.get("status"):
            qs = qs.filter(status=p["status"])
        elif p.get("open") == "1":
            qs = qs.filter(status=TaskStatus.OPEN)
        if p.get("customer"):
            qs = qs.filter(customer_id=p["customer"])
        if p.get("assigned_to"):
            qs = qs.filter(assigned_to_id=p["assigned_to"])
        if p.get("priority"):
            qs = qs.filter(priority=p["priority"])
        search = (p.get("q") or "").strip()
        if search:
            qs = qs.filter(
                Q(title__icontains=search) | Q(customer__name__icontains=search)
            )
        return qs

    def list(self, request, *args, **kwargs):
        # Abertas primeiro, depois por prazo (sem prazo por último), prioridade
        # (urgente antes) e recência -- só na listagem, para não quebrar o
        # get_object() das rotas de detalhe.
        far = date(9999, 12, 31)
        items = sorted(
            self.get_queryset(),
            key=lambda t: (
                0 if t.status == TaskStatus.OPEN else 1,
                t.due_date or far,
                -PRIORITY_ORDER.get(t.priority, 0),
                -t.id,
            ),
        )
        # Sem ?page: array cortado em 200; com ?page: envelope paginado.
        page = self.paginate_queryset(items)
        return self.get_paginated_response(TaskSerializer(page, many=True).data)

    @action(detail=False, methods=["get"], url_path="pending-count")
    def pending_count(self, request):
        count = CrmTask.objects.filter(status=TaskStatus.OPEN).count()
        return Response({"count": count})

    def perform_create(self, serializer):
        task = serializer.save(
            created_by=self.request.user if self.request.user.is_authenticated else None
        )
        record_audit(self.request, "crm.task.created", new_value={"task": task.id})

    def perform_update(self, serializer):
        task = serializer.save()
        record_audit(
            self.request,
            "crm.task.update",
            new_value={"task": task.id, "status": task.status},
        )

    def perform_destroy(self, instance):
        task_id = instance.id
        instance.delete()
        record_audit(self.request, "crm.task.deleted", new_value={"task": task_id})


class CampaignViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = CampaignSerializer
    queryset = CrmCampaign.objects.all()
    permission_classes = [HasModulePermission]
    permission_module = "crm"
    permission_action_map = {
        "create": "create_campaign",
        "update": "create_campaign",
        "partial_update": "create_campaign",
        "approve": "create_campaign",
    }

    def perform_create(self, serializer):
        campaign = serializer.save(
            created_by=self.request.user if self.request.user.is_authenticated else None
        )
        record_audit(
            self.request, "crm.campaign.created", new_value={"campaign": campaign.id}
        )

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        campaign = self.get_object()
        campaign.status = CampaignStatus.APPROVED
        campaign.save(update_fields=["status"])
        record_audit(
            request, "crm.campaign.approved", new_value={"campaign": campaign.id}
        )
        return Response(CampaignSerializer(campaign).data)


class CrmSettingsView(APIView):
    def get_permissions(self):
        code = "crm.configure" if self.request.method == "PATCH" else "crm.view"
        return [require_permission(code)()]

    def get(self, request):
        return Response(SettingsSerializer(CrmSettings.get_solo()).data)

    def patch(self, request):
        conf = CrmSettings.get_solo()
        serializer = SettingsSerializer(conf, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.user)
        record_audit(
            request,
            "crm.settings.update",
            new_value={"changed": list(request.data.keys())},
        )
        return Response(serializer.data)
