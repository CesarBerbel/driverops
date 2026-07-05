from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models


class Permission(models.Model):
    """Permissão granular ``modulo.acao`` (ex.: ``orders.cancel``).

    Semeada a partir do catálogo em ``apps.accounts.rbac``. ``is_critical`` marca
    permissões sensíveis (concedidas apenas pelo superuser na tela de permissões).
    """

    codename = models.CharField(max_length=64, unique=True)
    module = models.CharField(max_length=32)
    action = models.CharField(max_length=32)
    label = models.CharField(max_length=100)
    is_critical = models.BooleanField(default=False)

    class Meta:
        ordering = ["module", "action"]

    def __str__(self):
        return self.codename


class Role(models.Model):
    """Perfil operacional (Administrador, Atendente, Técnico, Estoque, Financeiro).

    O superuser NÃO é um perfil -- é um tipo especial de usuário com acesso total.
    """

    key = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_system = models.BooleanField(default=True)
    permissions = models.ManyToManyField(Permission, related_name="roles", blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("O e-mail é obrigatório.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superusuário precisa ter is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superusuário precisa ter is_superuser=True.")

        return self._create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    class Specialty(models.TextChoices):
        # Subtipo do perfil Técnico (não substitui o perfil).
        MECHANIC = "mechanic", "Mecânico"
        BODYWORKER = "bodyworker", "Funileiro"
        ELECTRICIAN = "electrician", "Eletricista"
        HELPER = "helper", "Ajudante"

    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=11, blank=True)
    whatsapp = models.CharField(max_length=11, blank=True)
    role = models.ForeignKey(
        Role, on_delete=models.SET_NULL, null=True, blank=True, related_name="users"
    )
    technical_specialty = models.CharField(
        max_length=20, choices=Specialty.choices, blank=True
    )
    force_password_change = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        ordering = ["email"]

    def __str__(self):
        return self.email

    def get_full_name(self):
        return self.full_name or self.email

    def get_short_name(self):
        return self.full_name.split(" ")[0] if self.full_name else self.email

    # --- RBAC: permissões efetivas ---

    def effective_permission_codes(self):
        """Conjunto de codenames que o usuário efetivamente possui.

        Superuser tem todas. Demais: permissões do perfil ∪ concedidas
        individualmente − removidas individualmente.
        """
        if self.is_superuser:
            return set(Permission.objects.values_list("codename", flat=True))
        codes = set()
        if self.role_id:
            codes |= set(self.role.permissions.values_list("codename", flat=True))
        for override in self.permission_overrides.select_related("permission"):
            if override.grant_type == UserPermission.GrantType.GRANT:
                codes.add(override.permission.codename)
            else:
                codes.discard(override.permission.codename)
        return codes

    def has_perm_code(self, codename):
        """True se o usuário (ativo) pode executar a ação ``modulo.acao``."""
        if not self.is_active:
            return False
        if self.is_superuser:
            return True
        return codename in self.effective_permission_codes()


class UserPermission(models.Model):
    """Ajuste individual de permissão (concessão ou remoção) sobre o perfil.

    Permite conceder uma permissão extra a um usuário ou remover uma que ele
    herdaria do perfil, sem alterar o perfil. Só o superuser gerencia isto.
    """

    class GrantType(models.TextChoices):
        GRANT = "grant", "Concedida"
        REVOKE = "revoke", "Removida"

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="permission_overrides"
    )
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)
    grant_type = models.CharField(max_length=10, choices=GrantType.choices)

    class Meta:
        unique_together = [("user", "permission")]

    def __str__(self):
        return f"{self.user.email} {self.grant_type} {self.permission.codename}"


class AuditLog(models.Model):
    """Trilha de auditoria de ações sensíveis de usuários/permissões."""

    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_actions",
    )
    target_user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_targets",
    )
    action = models.CharField(max_length=64)
    old_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.action} @ {self.created_at:%Y-%m-%d %H:%M}"
