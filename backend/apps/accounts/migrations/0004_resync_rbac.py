from django.db import migrations

from apps.accounts.rbac import ROLE_DEFS, all_permission_defs


def resync(apps, schema_editor):
    """Re-sincroniza permissões e perfis a partir do catálogo (idempotente).

    Necessário para bancos já migrados receberem mudanças no catálogo -- aqui, o
    perfil Administrador passa a incluir ``users.manage`` (gerenciar usuários),
    mantendo ``permissions.manage`` exclusivo do superuser.
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
    dependencies = [("accounts", "0003_seed_rbac")]

    operations = [migrations.RunPython(resync, migrations.RunPython.noop)]
