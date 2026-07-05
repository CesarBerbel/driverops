from django.db import migrations

from apps.accounts.rbac import ROLE_DEFS, all_permission_defs


def seed_rbac(apps, schema_editor):
    Permission = apps.get_model("accounts", "Permission")
    Role = apps.get_model("accounts", "Role")

    # Permissões (upsert por codename).
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

    # Perfis + vínculo com as permissões.
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


def unseed_rbac(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    Permission = apps.get_model("accounts", "Permission")
    Role.objects.filter(key__in=ROLE_DEFS.keys()).delete()
    Permission.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_permission_user_force_password_change_user_notes_and_more"),
    ]

    operations = [migrations.RunPython(seed_rbac, unseed_rbac)]
