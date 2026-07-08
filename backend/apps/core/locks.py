from django.db import connection
from django.db.models import Max


def acquire_transaction_lock(lock_name):
    """Acquire a named transaction-scoped lock when the database supports it.

    PostgreSQL advisory transaction locks are used to serialize critical sections
    that do not have a natural row to lock yet, such as assigning the first
    human-facing sequential number of a table. On other databases this is a
    no-op; the application is designed to run on PostgreSQL in production.
    """
    if connection.vendor != "postgresql":
        return
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT pg_advisory_xact_lock(hashtext(%s)::bigint)", [lock_name]
        )


def assign_next_number(instance, field_name="number", lock_name=None):
    """Assign the next sequential integer for ``field_name`` under a DB lock."""
    if getattr(instance, field_name):
        return
    model = type(instance)
    lock_name = lock_name or f"{model._meta.label_lower}.{field_name}"
    acquire_transaction_lock(lock_name)
    last_number = model._default_manager.aggregate(m=Max(field_name))["m"] or 0
    setattr(instance, field_name, last_number + 1)
