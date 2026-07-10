"""Deduplica categorias ativas iguais e impede novas duplicidades.

Antes deste ajuste não havia unicidade no banco: o único guarda era um check
aplicacional sujeito a corrida, que podia deixar duas categorias ATIVAS do
mesmo tipo com o mesmo nome. Esta migração:

1. Para cada grupo (tipo + nome, case-insensitive) com mais de uma ativa,
   mantém a mais antiga (menor id), repoquando os referenciadores
   (Service/Part) para ela e desativando as demais -- sem apagar histórico.
2. Cria uma UniqueConstraint parcial (só ativas) que impede novas duplicidades.
"""

from django.db import migrations, models
from django.db.models.functions import Lower


def dedupe(apps, schema_editor):
    Category = apps.get_model("categories", "Category")
    Service = apps.get_model("services", "Service")
    Part = apps.get_model("parts", "Part")

    seen = {}  # (category_type, lower(name)) -> kept category id
    for cat in Category.objects.filter(is_active=True).order_by("id"):
        key = (cat.category_type, (cat.name or "").strip().lower())
        keeper = seen.get(key)
        if keeper is None:
            seen[key] = cat.id
            continue
        # Duplicata: repoquar referenciadores para a mantida e desativar esta.
        if cat.category_type == "service":
            Service.objects.filter(category_id=cat.id).update(category_id=keeper)
        elif cat.category_type == "part":
            Part.objects.filter(category_id=cat.id).update(category_id=keeper)
        cat.is_active = False
        cat.save(update_fields=["is_active"])


class Migration(migrations.Migration):
    dependencies = [
        ("categories", "0002_category_category_type_notes"),
        ("services", "0001_initial"),
        ("parts", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(dedupe, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="category",
            constraint=models.UniqueConstraint(
                "category_type",
                Lower("name"),
                condition=models.Q(is_active=True),
                name="uniq_active_category_type_name",
            ),
        ),
    ]
