from django.core.management.base import BaseCommand

from apps.accounts.models import Permission, Role
from apps.accounts.rbac import ROLE_DEFS, all_permission_defs


class Command(BaseCommand):
    help = "Cria/atualiza as permissões e os perfis do RBAC (idempotente)."

    def handle(self, *args, **options):
        perms_by_code = {}
        for codename, module, action, label, is_critical in all_permission_defs():
            perm, _ = Permission.objects.update_or_create(
                codename=codename,
                defaults={
                    "module": module,
                    "action": action,
                    "label": label,
                    "is_critical": is_critical,
                },
            )
            perms_by_code[codename] = perm

        for key, spec in ROLE_DEFS.items():
            role, _ = Role.objects.update_or_create(
                key=key,
                defaults={
                    "name": spec["name"],
                    "description": spec["description"],
                    "is_system": True,
                },
            )
            role.permissions.set(
                [perms_by_code[c] for c in spec["codes"] if c in perms_by_code]
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"RBAC semeado: {Permission.objects.count()} permissões e "
                f"{Role.objects.count()} perfis."
            )
        )
