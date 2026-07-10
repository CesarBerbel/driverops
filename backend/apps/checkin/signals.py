"""Remoção do arquivo em disco ao apagar uma foto do check-in.

Sem isto, apagar uma avaria/foto/pertence (ou o cascade ao remover a OS) deixava
o arquivo órfão no volume de mídia. O ``post_delete`` cobre exclusões diretas e
em cascata.
"""

from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import VehicleCheckInBelonging, VehicleCheckInPhoto, VehicleDamagePhoto


def _delete_file(field):
    if field:
        field.delete(save=False)


@receiver(post_delete, sender=VehicleDamagePhoto)
def _damage_photo_deleted(sender, instance, **kwargs):
    _delete_file(instance.file)


@receiver(post_delete, sender=VehicleCheckInPhoto)
def _checkin_photo_deleted(sender, instance, **kwargs):
    _delete_file(instance.file)


@receiver(post_delete, sender=VehicleCheckInBelonging)
def _belonging_photo_deleted(sender, instance, **kwargs):
    _delete_file(instance.photo)
