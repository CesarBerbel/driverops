from rest_framework.permissions import BasePermission

# DRF action -> ação de permissão padrão (view/create/edit/delete/reactivate).
DEFAULT_ACTION_MAP = {
    "list": "view",
    "retrieve": "view",
    "create": "create",
    "update": "edit",
    "partial_update": "edit",
    "destroy": "delete",
    "reactivate": "reactivate",
}


class IsSuperUser(BasePermission):
    message = "Apenas superusuários podem acessar este recurso."

    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and request.user.is_superuser
        )


def require_permission(codename):
    """Fábrica de permissão DRF que exige um codename específico (ex.: users.manage).

    Superuser sempre passa. Uso: ``permission_classes = [require_permission("users.manage")]``.
    """

    class _RequirePermission(BasePermission):
        message = "Você não tem permissão para esta ação."

        def has_permission(self, request, view):
            user = request.user
            return bool(user and user.is_authenticated and user.has_perm_code(codename))

    return _RequirePermission


class HasModulePermission(BasePermission):
    """Verifica ``<module>.<action>`` a partir do módulo do viewset e da action.

    O viewset define ``permission_module`` (ex.: "customers") e, opcionalmente,
    ``permission_action_map`` para mapear actions customizadas (ex.: {"send":
    "send"}). Superuser sempre passa. Actions não mapeadas são liberadas (o
    controle fino fica a cargo de mapeamentos explícitos).
    """

    message = "Você não tem permissão para esta ação."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.is_superuser:
            return True
        module = getattr(view, "permission_module", None)
        if not module:
            return True
        action_map = {
            **DEFAULT_ACTION_MAP,
            **getattr(view, "permission_action_map", {}),
        }
        action = getattr(view, "action", None)
        perm_action = action_map.get(action)
        if not perm_action:
            return True
        return user.has_perm_code(f"{module}.{perm_action}")
