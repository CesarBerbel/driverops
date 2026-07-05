from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.customers.utils import only_digits

from .models import AuditLog, Permission, Role

User = get_user_model()


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ["id", "codename", "module", "action", "label", "is_critical"]


class RoleSerializer(serializers.ModelSerializer):
    permission_codes = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = ["id", "key", "name", "description", "is_system", "permission_codes"]

    def get_permission_codes(self, obj):
        return sorted(obj.permissions.values_list("codename", flat=True))


class UserAdminSerializer(serializers.ModelSerializer):
    """Serialização de usuário para a tela de gerenciamento (superuser/users.manage)."""

    role = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(), required=False, allow_null=True
    )
    role_name = serializers.CharField(source="role.name", read_only=True, default=None)
    role_key = serializers.CharField(source="role.key", read_only=True, default=None)
    technical_specialty_display = serializers.CharField(
        source="get_technical_specialty_display", read_only=True, default=""
    )
    # Senha inicial (opcional se enviar convite por e-mail).
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    send_invite = serializers.BooleanField(
        write_only=True, required=False, default=False
    )

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "full_name",
            "phone",
            "whatsapp",
            "role",
            "role_name",
            "role_key",
            "technical_specialty",
            "technical_specialty_display",
            "is_active",
            "is_superuser",
            "force_password_change",
            "notes",
            "last_login",
            "date_joined",
            "password",
            "send_invite",
        ]
        read_only_fields = ["id", "is_superuser", "last_login", "date_joined"]

    def validate_email(self, value):
        value = value.strip().lower()
        qs = User.objects.filter(email__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Já existe um usuário com este e-mail.")
        return value

    def validate_full_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("O nome é obrigatório.")
        return value

    def validate_phone(self, value):
        return only_digits(value)

    def validate_whatsapp(self, value):
        return only_digits(value)

    def validate(self, attrs):
        # Perfil obrigatório na criação (usuários da tela nunca são superuser).
        role = attrs.get("role", getattr(self.instance, "role", None))
        if self.instance is None and role is None:
            raise serializers.ValidationError({"role": "O perfil é obrigatório."})
        # Especialidade técnica só quando o perfil for Técnico.
        specialty = attrs.get(
            "technical_specialty", getattr(self.instance, "technical_specialty", "")
        )
        if specialty and (role is None or role.key != "tecnico"):
            raise serializers.ValidationError(
                {"technical_specialty": "Especialidade só se aplica ao perfil Técnico."}
            )
        return attrs


class AuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.CharField(
        source="actor.email", read_only=True, default=None
    )
    target_email = serializers.CharField(
        source="target_user.email", read_only=True, default=None
    )

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "action",
            "actor_email",
            "target_email",
            "old_value",
            "new_value",
            "ip",
            "user_agent",
            "created_at",
        ]
