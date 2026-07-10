from django.apps import AppConfig


class CheckinConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.checkin"
    verbose_name = "Check-in do Veículo"

    def ready(self):
        from . import signals  # noqa: F401  (registra os post_delete)
