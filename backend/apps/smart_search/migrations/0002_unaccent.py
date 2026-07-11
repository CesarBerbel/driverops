from django.contrib.postgres.operations import UnaccentExtension
from django.db import migrations


class Migration(migrations.Migration):
    """Habilita a extensão ``unaccent`` do Postgres.

    A Busca Inteligente compara texto de forma insensível a acentos (ex.: a
    consulta "suspensao" encontra "suspensão"), usando ``__unaccent__icontains``.
    """

    dependencies = [
        ("smart_search", "0001_initial"),
    ]

    operations = [
        UnaccentExtension(),
    ]
