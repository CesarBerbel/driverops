from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("categories", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="category",
            name="category_type",
            field=models.CharField(
                choices=[
                    ("client", "Cliente"),
                    ("part", "Peça"),
                    ("service", "Serviço"),
                ],
                db_index=True,
                default="client",
                max_length=20,
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="category",
            name="notes",
            field=models.TextField(blank=True, default=""),
            preserve_default=False,
        ),
    ]
