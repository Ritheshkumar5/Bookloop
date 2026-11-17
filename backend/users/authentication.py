from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import SAFE_METHODS
from rest_framework_simplejwt.authentication import JWTAuthentication


class SoftJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except AuthenticationFailed:
            if request.method in SAFE_METHODS:
                return None
            raise
