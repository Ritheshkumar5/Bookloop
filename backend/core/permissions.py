from django.conf import settings
from rest_framework.permissions import BasePermission


def is_configured_admin(user):
    if not user or not user.is_authenticated:
        return False
    username = getattr(user, "get_username", lambda: "")()
    return bool(
        getattr(user, "is_superuser", False)
        or getattr(user, "is_admin_token", False)
        or (
            settings.ADMIN_USERNAME
            and username.casefold() == settings.ADMIN_USERNAME.casefold()
        )
    )


def is_admin(user):
    return is_configured_admin(user)


class IsAdminUser(BasePermission):
    message = "Admin access only."

    def has_permission(self, request, view):
        return is_configured_admin(request.user)


class IsAdminRole(BasePermission):
    message = "Admin access only."

    def has_permission(self, request, view):
        return is_admin(request.user)


class IsOwnerOrAdmin(BasePermission):
    message = "You do not have permission to change this listing."

    def has_object_permission(self, request, view, obj):
        return is_admin(request.user) or obj.seller_id == request.user.user_id
