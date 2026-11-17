from django.conf import settings
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication


class AdminPrincipal:
    is_authenticated = True
    is_anonymous = False
    is_superuser = False
    is_admin_token = True
    role = "admin"
    pk = None
    user_id = None

    def __init__(self, username):
        self.username = username

    def get_username(self):
        return self.username


class AdminJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        header = self.get_header(request)
        if header is None:
            return None

        raw_token = self.get_raw_token(header)
        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        if validated_token.get("is_admin") is True:
            expected_username = settings.ADMIN_USERNAME
            token_username = validated_token.get("admin_username", "")
            if (
                not expected_username
                or not isinstance(token_username, str)
                or token_username.casefold() != expected_username.casefold()
            ):
                raise AuthenticationFailed("Admin token is no longer valid.")
            return AdminPrincipal(token_username), validated_token

        user = self.get_user(validated_token)
        username = user.get_username()
        if not (
            user.is_superuser
            or (
                settings.ADMIN_USERNAME
                and username.casefold() == settings.ADMIN_USERNAME.casefold()
            )
        ):
            raise AuthenticationFailed("Admin access only.")
        return user, validated_token
