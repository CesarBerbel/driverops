from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import serializers

User = get_user_model()

INVALID_RESET_LINK_MESSAGE = "Link de redefinição inválido ou expirado."


class UserSerializer(serializers.ModelSerializer):
    """Usuário logado (``/users/me/``) com o RBAC necessário para o frontend."""

    role = serializers.CharField(source="role.key", read_only=True, default=None)
    role_name = serializers.CharField(source="role.name", read_only=True, default=None)
    technical_specialty_display = serializers.CharField(
        source="get_technical_specialty_display", read_only=True, default=""
    )
    permissions = serializers.SerializerMethodField()
    google_linked = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "full_name",
            "is_staff",
            "is_superuser",
            "date_joined",
            "role",
            "role_name",
            "technical_specialty",
            "technical_specialty_display",
            "force_password_change",
            "permissions",
            "google_linked",
        ]
        read_only_fields = fields

    def get_permissions(self, obj):
        return sorted(obj.effective_permission_codes())

    def get_google_linked(self, obj):
        return bool(obj.google_sub)


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["full_name"]


class LoginSerializer(serializers.Serializer):
    """Validates only shape/format. Credential checking happens in the view
    so that invalid credentials can return 401 (auth failure) rather than
    400 (malformed request) -- see LoginView.post."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Senha atual incorreta.")
        return value

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError(
                {"new_password_confirm": "As senhas não coincidem."}
            )
        validate_password(attrs["new_password"], user=self.context["request"].user)
        return attrs


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError(
                {"new_password_confirm": "As senhas não coincidem."}
            )

        try:
            uid = force_str(urlsafe_base64_decode(attrs["uid"]))
            user = User.objects.get(pk=uid)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            raise serializers.ValidationError(INVALID_RESET_LINK_MESSAGE)

        if not default_token_generator.check_token(user, attrs["token"]):
            raise serializers.ValidationError(INVALID_RESET_LINK_MESSAGE)

        validate_password(attrs["new_password"], user=user)
        attrs["user"] = user
        return attrs
