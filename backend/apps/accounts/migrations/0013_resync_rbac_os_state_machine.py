from django.db import migrations

from apps.accounts.rbac import ROLE_DEFS, all_permission_defs


def resync(apps, schema_editor):
    """Re-sincroniza permissões e perfis (idempotente).

    Aqui: adiciona ``orders.reopen`` e ``orders.force_transition`` (críticas, da
    máquina de estados da OS). Ambas ficam superuser-only por padrão -- nenhum
    perfil semeado as recebe, como já ocorre com cancelar/finalizar.
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
    dependencies = [("accounts", "0012_resync_rbac_customer_interactions")]

    operations = [migrations.RunPython(resync, migrations.RunPython.noop)]
