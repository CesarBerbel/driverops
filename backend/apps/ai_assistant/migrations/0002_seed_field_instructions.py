from django.db import migrations


def seed(apps, schema_editor):
    """Semeia as instruções padrão por campo (idempotente)."""
    from apps.ai_assistant.fields import FIELDS

    AIFieldInstruction = apps.get_model("ai_assistant", "AIFieldInstruction")
    for spec in FIELDS:
        AIFieldInstruction.objects.get_or_create(
            field_key=spec["field_key"],
            defaults={k: v for k, v in spec.items() if k != "field_key"},
        )


def unseed(apps, schema_editor):
    AIFieldInstruction = apps.get_model("ai_assistant", "AIFieldInstruction")
    AIFieldInstruction.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [("ai_assistant", "0001_initial")]

    operations = [migrations.RunPython(seed, unseed)]
