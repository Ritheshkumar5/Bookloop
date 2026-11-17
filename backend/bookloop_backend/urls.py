from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.contrib.auth import views as auth_views
from django.urls import include, path

from users.views import PasswordResetConfirmAPIView, PasswordResetRequestView

urlpatterns = [
    path("admin/", admin.site.urls),
    path(
        "password-reset/",
        auth_views.PasswordResetView.as_view(
            extra_email_context={"frontend_url": settings.FRONTEND_URL}
        ),
        name="password_reset",
    ),
    path(
        "password-reset/done/",
        auth_views.PasswordResetDoneView.as_view(),
        name="password_reset_done",
    ),
    path(
        "reset/<uidb64>/<token>/",
        auth_views.PasswordResetConfirmView.as_view(),
        name="password_reset_confirm",
    ),
    path(
        "reset/done/",
        auth_views.PasswordResetCompleteView.as_view(
            extra_context={"frontend_url": settings.FRONTEND_URL}
        ),
        name="password_reset_complete",
    ),
    path("api/users/", include("users.urls")),
    path(
        "api/password-reset/",
        PasswordResetRequestView.as_view(),
        name="password_reset_api",
    ),
    path(
        "api/password-reset/<uidb64>/<token>/",
        PasswordResetConfirmAPIView.as_view(),
        name="password_reset_confirm_api",
    ),
    path("api/admin/", include("core.admin_urls")),
    path("api/books/", include("books.urls")),
    path("api/orders/", include("orders.urls")),
    path("api/chats/", include("chats.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
