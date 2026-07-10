"""Regressão: apagar uma foto do check-in remove o arquivo do disco.

Antes, excluir a avaria/foto (ou o cascade ao remover a OS) deixava o arquivo
órfão no volume de mídia.
"""

import os

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.checkin.models import VehicleCheckIn, VehicleDamage, VehicleDamagePhoto

pytestmark = pytest.mark.django_db

PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000a49444154789c6300010000050001"
    "0d0a2db40000000049454e44ae426082"
)


def _photo(order, settings, tmp_path):
    settings.MEDIA_ROOT = str(tmp_path)
    check_in = VehicleCheckIn.objects.create(order=order)
    damage = VehicleDamage.objects.create(
        check_in=check_in, x=10, y=20, description="Risco na porta"
    )
    return VehicleDamagePhoto.objects.create(
        damage=damage,
        file=SimpleUploadedFile("foto.png", PNG, content_type="image/png"),
    )


def test_deleting_photo_removes_file(order, settings, tmp_path):
    photo = _photo(order, settings, tmp_path)
    path = photo.file.path
    assert os.path.exists(path)
    photo.delete()
    assert not os.path.exists(path)


def test_deleting_damage_cascades_and_removes_photo_file(order, settings, tmp_path):
    photo = _photo(order, settings, tmp_path)
    path = photo.file.path
    assert os.path.exists(path)
    # Excluir a avaria remove as fotos em cascata -> arquivos limpos pelo signal.
    photo.damage.delete()
    assert not os.path.exists(path)
