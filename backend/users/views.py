from django.conf import settings
from django.contrib.auth.forms import PasswordResetForm, SetPasswordForm
from django.contrib.auth.tokens import default_token_generator
from django.db.models import Q
from django.utils.http import urlsafe_base64_decode
from rest_framework import generics, status
from rest_framework.filters import SearchFilter
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from core.exceptions import BadRequest
from core.permissions import IsAdminRole

from .models import User
from .serializers import (
    AdminUserSerializer,
    LoginSerializer,
    ProfileUpdateSerializer,
    RegisterSerializer,
    UserSerializer,
)


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    authentication_classes = []


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        form = PasswordResetForm(data={"email": request.data.get("email", "")})
        if not form.is_valid():
            return Response(
                {"email": form.errors.get("email", ["Enter a valid email address."])},
                status=status.HTTP_400_BAD_REQUEST,
            )

        form.save(
            request=request,
            use_https=request.is_secure(),
            email_template_name="registration/password_reset_email.html",
            subject_template_name="registration/password_reset_subject.txt",
            extra_email_context={"frontend_url": settings.FRONTEND_URL},
        )
        return Response(
            {"detail": "If an account exists, a reset link has been sent"}
        )


class PasswordResetConfirmAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @staticmethod
    def get_user(uidb64, token):
        try:
            user_id = urlsafe_base64_decode(uidb64).decode()
            user = User.objects.get(pk=user_id)
        except (
            User.DoesNotExist,
            TypeError,
            ValueError,
            OverflowError,
        ):
            return None
        return user if default_token_generator.check_token(user, token) else None

    @staticmethod
    def invalid_link_response():
        return Response(
            {"detail": "This password reset link is invalid or has expired."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    def get(self, request, uidb64, token):
        if self.get_user(uidb64, token) is None:
            return self.invalid_link_response()
        return Response({"detail": "Password reset link is valid."})

    def post(self, request, uidb64, token):
        user = self.get_user(uidb64, token)
        if user is None:
            return self.invalid_link_response()

        form = SetPasswordForm(user, data=request.data)
        if not form.is_valid():
            errors = [
                str(message)
                for field_errors in form.errors.values()
                for message in field_errors
            ]
            return Response(
                {"detail": " ".join(errors)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        form.save()
        return Response({"detail": "Password reset successfully."})


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()
        user = User.objects.filter(email__iexact=email).first()
        if user is None or not user.check_password(serializer.validated_data["password"]):
            return Response(
                {"detail": "Invalid email or password."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        if user.is_blocked:
            warning_message = user.warning_message.strip().rstrip(".")
            return Response(
                {
                    "detail": (
                        f"Your account is blocked: "
                        f"{warning_message or 'No reason was provided'}. Contact Admin."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        if not user.is_active:
            return Response(
                {"detail": "Your account has been suspended. Please contact support."},
                status=status.HTTP_403_FORBIDDEN,
            )
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserSerializer(user).data,
            }
        )


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            token = RefreshToken(request.data.get("refresh"))
            token.blacklist()
        except (TokenError, TypeError):
            return Response(
                {"detail": "Invalid refresh token."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_205_RESET_CONTENT)


class MeView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        return ProfileUpdateSerializer if self.request.method == "PATCH" else UserSerializer


class AdminUserListView(generics.ListAPIView):
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdminRole]
    pagination_class = None
    filter_backends = [SearchFilter]
    search_fields = ["full_name", "email", "city", "college_name"]

    def get_queryset(self):
        queryset = User.objects.all()
        role = self.request.query_params.get("role")
        active = self.request.query_params.get("is_active")
        if role:
            queryset = queryset.filter(role=role)
        if active in ("true", "false"):
            queryset = queryset.filter(is_active=active == "true")
        return queryset


class AdminUserDetailView(generics.RetrieveUpdateAPIView):
    queryset = User.objects.all()
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdminRole]
    http_method_names = ["get", "patch", "head", "options"]

    def partial_update(self, request, *args, **kwargs):
        target = self.get_object()
        if target.pk == request.user.pk:
            raise BadRequest("You cannot suspend or change your own account.")
        if "role" in request.data and request.data["role"] not in User.Role.values:
            raise BadRequest("Invalid user role.")
        if request.data.get("role") == User.Role.ADMIN:
            target.is_staff = True
        response = super().partial_update(request, *args, **kwargs)
        target.refresh_from_db()
        if target.role != User.Role.ADMIN:
            target.is_staff = False
            target.save(update_fields=["is_staff"])
        return response
