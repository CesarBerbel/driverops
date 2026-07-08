from django.db import migrations


def seed_templates(apps, schema_editor):
    """Semeia os templates padrão (idempotente) para os canais semeados.

    Usa ``update_or_create`` para não sobrescrever personalizações já feitas
    (só cria o que ainda não existe; re-rodar não apaga edições do usuário).
    """
    from apps.notifications.defaults import iter_default_templates

    NotificationTemplate = apps.get_model("notifications", "NotificationTemplate")
    for event, channel, fields in iter_default_templates():
        NotificationTemplate.objects.get_or_create(
            event=event,
            channel=channel,
            defaults={
                "name": fields["name"],
                "description": fields["description"],
                "subject": fields["subject"],
                "html_content": fields["html_content"],
                "text_content": fields["text_content"],
                "is_active": True,
                "is_customized": False,
            },
        )


def unseed(apps, schema_editor):
    NotificationTemplate = apps.get_model("notifications", "NotificationTemplate")
    NotificationTemplate.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [("notifications", "0001_initial")]

    operations = [migrations.RunPython(seed_templates, unseed)]
