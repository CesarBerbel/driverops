from django.db import migrations


def seed(apps, schema_editor):
    """Semeia os templates do evento payment_received (idempotente)."""
    from apps.notifications.defaults import SEEDED_CHANNELS, default_template

    NotificationTemplate = apps.get_model("notifications", "NotificationTemplate")
    for channel in SEEDED_CHANNELS:
        fields = default_template("payment_received", channel)
        NotificationTemplate.objects.get_or_create(
            event="payment_received",
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
    NotificationTemplate.objects.filter(event="payment_received").delete()


class Migration(migrations.Migration):
    dependencies = [("notifications", "0002_seed_templates")]

    operations = [migrations.RunPython(seed, unseed)]
