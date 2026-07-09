from django.db import migrations


def use_openai_default(apps, schema_editor):
    """Passa o registro único de IA para OpenAI (gpt-4o-mini) e ativa.

    Só ajusta se ainda estiver no default antigo (Anthropic / claude-opus-4-8,
    sem customização) -- não sobrescreve uma configuração já escolhida pela
    oficina. Deixa ``api_key_env`` vazio para usar a env padrão ``OPENAI_API_KEY``.
    """
    AISettings = apps.get_model("ai_assistant", "AISettings")
    obj = AISettings.objects.filter(pk=1).first()
    if obj is None:
        return
    if obj.provider == "anthropic" and obj.model == "claude-opus-4-8":
        obj.provider = "openai"
        obj.model = "gpt-4o-mini"
        obj.api_key_env = ""
        obj.is_active = True
        obj.save(
            update_fields=[
                "provider",
                "model",
                "api_key_env",
                "is_active",
                "updated_at",
            ]
        )


class Migration(migrations.Migration):
    dependencies = [
        ("ai_assistant", "0003_alter_aisettings_model_alter_aisettings_provider"),
    ]

    operations = [migrations.RunPython(use_openai_default, migrations.RunPython.noop)]
