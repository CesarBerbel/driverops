"""Popula a tabela auxiliar VehicleBrand com as marcas conhecidas no Brasil.

Idempotente (get_or_create por nome) e reversível (não apaga nada no downgrade,
já que a marca é só sugestão de autocomplete).
"""

from django.db import migrations

from apps.vehicles.vehicle_brands import VEHICLE_BRANDS


def seed_brands(apps, schema_editor):
    VehicleBrand = apps.get_model("vehicles", "VehicleBrand")
    for name in VEHICLE_BRANDS:
        VehicleBrand.objects.get_or_create(name=name, defaults={"is_active": True})


def unseed_brands(apps, schema_editor):
    # No-op: são apenas sugestões; não removemos na reversão.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("vehicles", "0003_vehiclebrand"),
    ]

    operations = [
        migrations.RunPython(seed_brands, unseed_brands),
    ]
