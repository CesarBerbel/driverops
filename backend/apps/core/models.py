from django.db import models


class SingletonModel(models.Model):
    """Base para modelos de configuração com um único registro (pk=1).

    Base abstrata compartilhada: força o pk em 1 no save e expõe ``get_solo()``
    para obter/criar o registro. Antes cada app reimplementava este padrão
    (workshop, alerts, ai_assistant, leads) -- agora todos herdam daqui.
    """

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
