from django.db import migrations

from apps.accounts.rbac import ROLE_DEFS, all_permission_defs


def resync(apps, schema_editor):
    """Re-sincroniza permissões e perfis a partir do catálogo (idempotente).

    Aqui: adiciona ``financial.register_expense`` (registrar despesa) e a inclui
    no perfil Financeiro; o Administrador a recebe por ser não crítica.
    """
    Permission = apps.get_model("accounts", "Permission")
    Role = apps.get_model("accounts", "Role")

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


class Migration(migrations.Migration):
    dependencies = [("accounts", "0004_resync_rbac")]

    operations = [migrations.RunPython(resync, migrations.RunPython.noop)]
