from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.audit import record_audit
from apps.accounts.permissions import HasModulePermission, require_permission

from .fields import (
    ACTIONS,
    AUDIENCES,
    CONTEXT_GROUPS,
    DETAIL_LEVELS,
    FIELD_CHOICES,
    TONES,
)
from .models import AIFieldInstruction, AISettings, AIUsageLog
from .prompt import ActionNotAllowed
from .providers import AIProviderError
from .serializers import (
    AIFieldInstructionSerializer,
    AISettingsSerializer,
    AIUsageLogSerializer,
)
from .services import AIDisabledError, generate_suggestion


class _CanViewOrUseAI(BasePermission):
    """Permite acesso a quem pode configurar (ai.view) OU usar (ai.use) a IA."""

    message = "Você não tem permissão para usar a IA."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        return (
            user.is_superuser
            or user.has_perm_code("ai.view")
            or user.has_perm_code("ai.use")
        )


_AUDITED_SETTINGS = [
    "is_active", "provider", "model", "base_url", "api_key_env",
    "temperature", "max_tokens", "timeout_seconds", "log_texts", "retention_days",
]


def _ensure_seeded():
    """Garante que as instruções de todos os campos existem (idempotente)."""
    from .fields import FIELDS

    existing = set(AIFieldInstruction.objects.values_list("field_key", flat=True))
    for spec in FIELDS:
        if spec["field_key"] not in existing:
            AIFieldInstruction.objects.get_or_create(
                field_key=spec["field_key"], defaults=spec
            )


class AISettingsView(APIView):
    """Configuração global do módulo (registro único). GET=ai.view, PATCH=ai.edit."""

    def get_permissions(self):
        code = "ai.edit" if self.request.method == "PATCH" else "ai.view"
        return [require_permission(code)()]

    def get(self, request):
        settings = AISettings.get_solo()
        return Response(AISettingsSerializer(settings).data)

    def patch(self, request):
        settings = AISettings.get_solo()
        before = {f: getattr(settings, f) for f in _AUDITED_SETTINGS}
        serializer = AISettingsSerializer(settings, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save(updated_by=request.user)
        after = {f: getattr(updated, f) for f in _AUDITED_SETTINGS}
        changed = {f: {"from": before[f], "to": after[f]} for f in _AUDITED_SETTINGS if before[f] != after[f]}
        record_audit(request, "ai.settings.update", new_value={"changed": changed})
        return Response(AISettingsSerializer(updated).data)


class AIMetadataView(APIView):
    """Catálogo (campos, ações, tons, públicos, grupos de contexto) + estado.

    Acessível a quem configura (ai.view) ou usa (ai.use), pois a integração da OS
    depende dele. Inclui ``active`` (módulo ligado) e as capacidades por campo,
    para o frontend filtrar as ações disponíveis sem precisar de ai.view.
    """

    permission_classes = [_CanViewOrUseAI]

    def get(self, request):
        _ensure_seeded()
        settings = AISettings.get_solo()
        caps = {
            i.field_key: {
                "active": i.is_active,
                "can_rewrite": i.can_rewrite,
                "can_fix_grammar": i.can_fix_grammar,
                "can_summarize": i.can_summarize,
                "can_expand": i.can_expand,
            }
            for i in AIFieldInstruction.objects.all()
        }
        return Response(
            {
                "active": settings.is_active,
                "fields": [
                    {"key": k, "label": v, **caps.get(k, {})} for k, v in FIELD_CHOICES
                ],
                "actions": [
                    {"key": k, "label": label, "required_flag": flag}
                    for k, label, _instr, flag in ACTIONS
                ],
                "tones": [{"key": k, "label": v} for k, v in TONES],
                "detail_levels": [{"key": k, "label": v} for k, v in DETAIL_LEVELS],
                "audiences": [{"key": k, "label": v} for k, v in AUDIENCES],
                "context_groups": [{"key": k, "label": v} for k, v in CONTEXT_GROUPS],
            }
        )


class AIFieldInstructionViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Instruções por campo (catálogo fixo): listar/editar/restaurar."""

    serializer_class = AIFieldInstructionSerializer
    permission_classes = [HasModulePermission]
    permission_module = "ai"
    permission_action_map = {"restore": "edit", "restore_all": "edit"}

    def get_queryset(self):
        _ensure_seeded()
        return AIFieldInstruction.objects.select_related("updated_by")

    def perform_update(self, serializer):
        instruction = serializer.save(updated_by=self.request.user, is_customized=True)
        record_audit(
            self.request,
            "ai.field.update",
            new_value={"field_key": instruction.field_key},
        )

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        instruction = self.get_object()
        instruction.apply_default()
        instruction.updated_by = request.user
        instruction.save()
        record_audit(
            request, "ai.field.restore", new_value={"field_key": instruction.field_key}
        )
        return Response(self.get_serializer(instruction).data)

    @action(detail=False, methods=["post"], url_path="restore-all")
    def restore_all(self, request):
        _ensure_seeded()
        for instruction in AIFieldInstruction.objects.all():
            instruction.apply_default()
            instruction.updated_by = request.user
            instruction.save()
        record_audit(request, "ai.field.restore_all", new_value={"all": True})
        return Response(
            AIFieldInstructionSerializer(self.get_queryset(), many=True).data
        )


class AIGenerateView(APIView):
    """Gera uma sugestão para um campo/ação. Permissão: ai.use."""

    permission_classes = [require_permission("ai.use")]

    def post(self, request):
        return _run_generation(request, is_test=False)


class AITestView(APIView):
    """Testa o prompt com um texto de exemplo (sem OS). Permissão: ai.test."""

    permission_classes = [require_permission("ai.test")]

    def post(self, request):
        return _run_generation(request, is_test=True)


def _run_generation(request, *, is_test):
    field_key = request.data.get("field")
    action_key = request.data.get("action")
    text = request.data.get("text", "")
    if not field_key or not action_key:
        raise ValidationError({"detail": "Informe o campo e a ação."})
    if not (text or "").strip():
        raise ValidationError({"text": "Informe o texto a ser trabalhado."})

    work_order = None
    if not is_test and request.data.get("work_order"):
        # Só usa a OS se o usuário puder visualizá-la.
        if not request.user.has_perm_code("orders.view"):
            raise PermissionDenied("Sem permissão para usar dados da OS.")
        from apps.orders.models import WorkOrder

        work_order = WorkOrder.objects.filter(pk=request.data.get("work_order")).first()

    try:
        result = generate_suggestion(
            user=request.user,
            field_key=field_key,
            action=action_key,
            original_text=text,
            work_order=work_order,
            request=request,
            is_test=is_test,
        )
    except ActionNotAllowed as exc:
        raise ValidationError({"detail": str(exc)})
    except AIDisabledError as exc:
        return Response(
            {"detail": exc.user_message, "code": exc.code}, status=409
        )
    except AIProviderError as exc:
        # Falha de provedor: preserva o texto original (o frontend não substitui).
        status = 422 if exc.code in ("config_incomplete", "auth_error") else 503
        return Response(
            {"detail": exc.user_message, "code": exc.code}, status=status
        )

    return Response(
        {
            "suggestion": result.suggestion,
            "field": result.field_key,
            "action": result.action,
            "provider": result.provider,
            "model": result.model,
            "log_id": result.log_id,
            "input_tokens": result.input_tokens,
            "output_tokens": result.output_tokens,
        }
    )


class AIUsageLogViewSet(
    mixins.ListModelMixin, viewsets.GenericViewSet
):
    """Log de uso da IA. Listar exige ai.logs; marcar desfecho exige ai.use."""

    serializer_class = AIUsageLogSerializer
    permission_classes = [HasModulePermission]
    permission_module = "ai"
    permission_action_map = {"list": "logs", "outcome": "use"}

    def get_queryset(self):
        queryset = AIUsageLog.objects.select_related("user")
        params = self.request.query_params
        if params.get("field"):
            queryset = queryset.filter(field_key=params["field"])
        if params.get("status"):
            queryset = queryset.filter(status=params["status"])
        return queryset[:200]

    @action(detail=True, methods=["post"])
    def outcome(self, request, pk=None):
        """Registra se a sugestão foi aplicada ou descartada."""
        log = AIUsageLog.objects.filter(pk=pk).first()
        if log is None:
            raise ValidationError({"detail": "Registro não encontrado."})
        applied = request.data.get("applied")
        if not isinstance(applied, bool):
            raise ValidationError({"applied": "Informe true/false."})
        log.applied = applied
        log.save(update_fields=["applied"])
        return Response({"applied": applied})
