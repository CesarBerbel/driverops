from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .cookies import clear_auth_cookies, set_auth_cookies
from .emails import send_password_reset_email
from .google import GoogleAuthError, google_login_enabled, verify_google_id_token
from .permissions import IsSuperUser
from .serializers import (
    ChangePasswordSerializer,
    LoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    UserSerializer,
    UserUpdateSerializer,
)

User = get_user_model()

SESSION_EXPIRED_MESSAGE = "Sessão expirada. Faça login novamente."


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = authenticate(
            request=request,
            email=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
        )
        if user is None or not user.is_active:
            return Response(
                {"detail": "E-mail ou senha inválidos."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        return _login_response(user)


def _login_response(user):
    """Emite o par de tokens em cookies HttpOnly e devolve o usuário -- mesmo
    contrato do login por e-mail/senha, reutilizado pelo login com Google."""
    refresh = RefreshToken.for_user(user)
    response = Response({"user": UserSerializer(user).data}, status=status.HTTP_200_OK)
    set_auth_cookies(response, str(refresh.access_token), str(refresh))
    return response


class GoogleLoginView(APIView):
    """Entrar com Google (ID token do Google Identity Services).

    Só autentica usuários JÁ existentes: encontra pela conta Google vinculada
    (``google_sub``) ou, na primeira vez, pelo e-mail VERIFICADO do Google que
    bate com um usuário ativo -- e nesse caso vincula automaticamente. Nunca
    cria conta nova.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        if not google_login_enabled():
            return Response(
                {"detail": "Login com Google não está disponível."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        try:
            info = verify_google_id_token(request.data.get("credential", ""))
        except GoogleAuthError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_401_UNAUTHORIZED)

        user = User.objects.filter(google_sub=info["sub"]).first()
        if user is None:
            # Vínculo automático por e-mail verificado que casa com um usuário ativo.
            if not info["email_verified"]:
                return Response(
                    {"detail": "Seu e-mail do Google não está verificado."},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
            user = User.objects.filter(
                email__iexact=info["email"], is_active=True
            ).first()
            if user is None:
                return Response(
                    {
                        "detail": (
                            "Não há uma conta com este e-mail. Peça ao "
                            "administrador para cadastrar você primeiro."
                        )
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
            user.google_sub = info["sub"]
            user.save(update_fields=["google_sub"])

        if not user.is_active:
            return Response(
                {"detail": "Conta desativada."}, status=status.HTTP_403_FORBIDDEN
            )
        return _login_response(user)


class GoogleLinkView(APIView):
    """Vincular (POST) / desvincular (DELETE) a conta Google do usuário logado."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not google_login_enabled():
            return Response(
                {"detail": "Login com Google não está disponível."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        try:
            info = verify_google_id_token(request.data.get("credential", ""))
        except GoogleAuthError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        taken = (
            User.objects.filter(google_sub=info["sub"])
            .exclude(pk=request.user.pk)
            .exists()
        )
        if taken:
            return Response(
                {"detail": "Esta conta Google já está vinculada a outro usuário."},
                status=status.HTTP_409_CONFLICT,
            )

        request.user.google_sub = info["sub"]
        request.user.save(update_fields=["google_sub"])
        return Response(UserSerializer(request.user).data)

    def delete(self, request):
        if request.user.google_sub:
            request.user.google_sub = None
            request.user.save(update_fields=["google_sub"])
        return Response(UserSerializer(request.user).data)


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        raw_refresh = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH)
        if raw_refresh:
            try:
                RefreshToken(raw_refresh).blacklist()
            except TokenError:
                pass

        response = Response(status=status.HTTP_204_NO_CONTENT)
        clear_auth_cookies(response)
        return response


class RefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        raw_refresh = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH)
        if not raw_refresh:
            return Response(
                {"detail": SESSION_EXPIRED_MESSAGE}, status=status.HTTP_401_UNAUTHORIZED
            )

        try:
            refresh = RefreshToken(raw_refresh)
            new_access = str(refresh.access_token)

            new_refresh_str = None
            if settings.SIMPLE_JWT.get("ROTATE_REFRESH_TOKENS"):
                if settings.SIMPLE_JWT.get("BLACKLIST_AFTER_ROTATION"):
                    try:
                        refresh.blacklist()
                    except AttributeError:
                        pass
                refresh.set_jti()
                refresh.set_exp()
                refresh.set_iat()
                new_refresh_str = str(refresh)
        except TokenError:
            response = Response(
                {"detail": SESSION_EXPIRED_MESSAGE}, status=status.HTTP_401_UNAUTHORIZED
            )
            clear_auth_cookies(response)
            return response

        response = Response(status=status.HTTP_204_NO_CONTENT)
        set_auth_cookies(response, new_access, new_refresh_str)
        return response


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)

        user = request.user
        user.set_password(serializer.validated_data["new_password"])
        # Trocar a senha satisfaz a exigência de troca no primeiro acesso.
        user.force_password_change = False
        user.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    GENERIC_RESPONSE = {
        "detail": "Se este e-mail estiver cadastrado, enviaremos um link de redefinição de senha."
    }

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user is not None:
            send_password_reset_email(user)

        # Always the same response, regardless of whether the email exists,
        # to avoid leaking which addresses are registered.
        return Response(self.GENERIC_RESPONSE, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]
        user.set_password(serializer.validated_data["new_password"])
        # Redefinir a senha (inclui o fluxo de convite) satisfaz a troca exigida.
        user.force_password_change = False
        user.save()
        return Response(
            {"detail": "Senha redefinida com sucesso."}, status=status.HTTP_200_OK
        )


class AdminPingView(APIView):
    """Trivial concrete example of an endpoint gated on is_superuser."""

    permission_classes = [IsAuthenticated, IsSuperUser]

    def get(self, request):
        return Response(
            {"detail": "Olá, superusuário. Você tem acesso total ao sistema."}
        )
