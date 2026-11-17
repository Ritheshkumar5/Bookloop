from django.urls import path

from .admin_api import (
    AdminBookDeleteView,
    AdminBookListView,
    AdminBookModerationView,
    AdminLoginView,
    AdminOrderListView,
    AdminPendingBookListView,
    AdminReportDetailView,
    AdminReportListView,
    AdminUserDeleteView,
    AdminUserDetailView,
    AdminUserListView,
)

urlpatterns = [
    path("login/", AdminLoginView.as_view(), name="admin-login"),
    path(
        "pending-books/",
        AdminPendingBookListView.as_view(),
        name="admin-pending-books",
    ),
    path("books/", AdminBookListView.as_view(), name="admin-books"),
    path(
        "approve-book/",
        AdminBookModerationView.as_view(),
        {"action": "approve"},
        name="admin-approve-book",
    ),
    path(
        "reject-book/",
        AdminBookModerationView.as_view(),
        {"action": "reject"},
        name="admin-reject-book",
    ),
    path("delete-book/", AdminBookDeleteView.as_view(), name="admin-delete-book"),
    path("users/", AdminUserListView.as_view(), name="admin-users"),
    path("users/<int:pk>/", AdminUserDetailView.as_view(), name="admin-user-detail"),
    path("delete-user/", AdminUserDeleteView.as_view(), name="admin-delete-user"),
    path("orders/", AdminOrderListView.as_view(), name="admin-orders"),
    path("reports/", AdminReportListView.as_view(), name="admin-reports"),
    path(
        "reports/<int:pk>/",
        AdminReportDetailView.as_view(),
        name="admin-report-detail",
    ),
]
