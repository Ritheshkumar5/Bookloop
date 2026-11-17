from django.contrib import admin
from django.contrib.auth.models import Group
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from .models import User


for model in (Group, BlacklistedToken, OutstandingToken):
    if model in admin.site._registry:
        admin.site.unregister(model)


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    ordering = ("-created_at",)
    list_display = ("email", "full_name", "is_active", "created_at")
    list_filter = ("role", "is_active", "is_blocked", "city")
    search_fields = ("email", "full_name", "college_name")
    readonly_fields = ("email", "full_name", "password", "created_at", "last_login")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Profile", {
            "fields": (
                "full_name", "phone", "city", "college_name", "department", "role",
                "phone_verified", "college_id_verified", "trust_score",
            )
        }),
        ("Status", {"fields": (
            "is_active", "is_blocked", "warning_message", "is_staff", "is_superuser",
            "groups", "user_permissions",
        )}),
        ("Dates", {"fields": ("created_at", "last_login")}),
    )
    actions = ["suspend_users", "activate_users", "unblock_users"]

    def has_add_permission(self, request):
        return False

    @admin.action(description="Suspend selected users")
    def suspend_users(self, request, queryset):
        queryset.exclude(pk=request.user.pk).update(is_active=False)

    @admin.action(description="Activate selected users")
    def activate_users(self, request, queryset):
        queryset.update(is_active=True)

    @admin.action(description="Unblock selected users")
    def unblock_users(self, request, queryset):
        queryset.filter(is_blocked=True).update(is_blocked=False, is_active=True)
