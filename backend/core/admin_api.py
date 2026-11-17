import secrets
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import ProtectedError
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import AccessToken

from books.models import Book
from books.serializers import BookSerializer
from core.admin_authentication import AdminJWTAuthentication
from core.exceptions import BadRequest, Conflict
from core.permissions import IsAdminUser
from orders.models import Order, Report
from orders.serializers import OrderSerializer, ReportSerializer
from orders.views import ReportDetailView
from users.models import User
from users.serializers import AdminUserSerializer


class AdminLoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin_login"

    def post(self, request):
        username = request.data.get("username", request.data.get("email", ""))
        password = request.data.get("password", "")
        if not isinstance(username, str) or not isinstance(password, str):
            raise ValidationError({"detail": "Username and password are required."})
        username = username.strip()

        configured_username = settings.ADMIN_USERNAME
        configured_password = settings.ADMIN_PASSWORD
        username_matches = bool(configured_username) and secrets.compare_digest(
            username.casefold().encode("utf-8"),
            configured_username.casefold().encode("utf-8"),
        )
        password_matches = bool(configured_password) and secrets.compare_digest(
            password.encode("utf-8"), configured_password.encode("utf-8")
        )
        if not (username_matches and password_matches):
            return Response(
                {"detail": "Invalid admin username or password."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        token = AccessToken()
        token["is_admin"] = True
        token["admin_username"] = configured_username
        token.set_exp(lifetime=timedelta(hours=1))
        return Response({"access": str(token), "is_admin": True})


class AdminAPIView(APIView):
    authentication_classes = [AdminJWTAuthentication]
    permission_classes = [IsAdminUser]


class AdminBookListView(AdminAPIView):
    def get(self, request):
        books = Book.objects.select_related("seller").all()
        status_filter = request.query_params.get("status")
        if status_filter:
            books = books.filter(status=status_filter)
        return Response(BookSerializer(books, many=True, context={"request": request}).data)


class AdminPendingBookListView(AdminAPIView):
    def get(self, request):
        books = Book.objects.select_related("seller").filter(status=Book.Status.PENDING)
        return Response(BookSerializer(books, many=True, context={"request": request}).data)


class AdminBookModerationView(AdminAPIView):
    def post(self, request, action):
        book = get_object_or_404(
            Book.objects.select_related("seller"), pk=request.data.get("book_id")
        )
        if action == "approve":
            book.status = Book.Status.APPROVED
            book.rejection_reason = None
        else:
            reason = str(request.data.get("rejection_reason", "")).strip()
            if not reason:
                raise BadRequest("Enter a rejection reason for the seller.")
            book.status = Book.Status.REJECTED
            book.rejection_reason = reason
        book.save(update_fields=["status", "rejection_reason"])
        return Response(BookSerializer(book, context={"request": request}).data)


class AdminBookDeleteView(AdminAPIView):
    def delete(self, request):
        book = get_object_or_404(
            Book.objects.select_related("seller"), pk=request.data.get("book_id")
        )
        if book.orders.exists():
            raise Conflict(
                "This listing has order history and cannot be deleted. Mark it as SOLD instead."
            )
        block_user = request.data.get("block_user", False)
        if isinstance(block_user, str):
            block_user = block_user.lower() in ("true", "1", "yes")
        warning_message = str(request.data.get("warning_message", "")).strip()
        if block_user and not warning_message:
            raise BadRequest("Enter a warning reason before blocking this seller.")

        with transaction.atomic():
            if block_user:
                book.seller.is_blocked = True
                book.seller.is_active = False
                book.seller.warning_message = warning_message
                book.seller.save(
                    update_fields=["is_blocked", "is_active", "warning_message"]
                )
            book.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminUserListView(AdminAPIView):
    def get(self, request):
        users = User.objects.all()
        role = request.query_params.get("role")
        if role:
            users = users.filter(role=role)
        return Response(AdminUserSerializer(users, many=True).data)


class AdminUserDetailView(generics.RetrieveUpdateAPIView):
    authentication_classes = [AdminJWTAuthentication]
    permission_classes = [IsAdminUser]
    queryset = User.objects.all()
    serializer_class = AdminUserSerializer
    http_method_names = ["get", "patch", "head", "options"]

    def partial_update(self, request, *args, **kwargs):
        target = self.get_object()
        if target.pk == getattr(request.user, "pk", None):
            raise BadRequest("You cannot suspend or change your own account.")
        if "role" in request.data and request.data["role"] not in User.Role.values:
            raise BadRequest("Invalid user role.")
        response = super().partial_update(request, *args, **kwargs)
        target.refresh_from_db()
        if target.role != User.Role.ADMIN and target.is_staff:
            target.is_staff = False
            target.save(update_fields=["is_staff"])
        return response


class AdminUserDeleteView(AdminAPIView):
    def delete(self, request):
        user = get_object_or_404(User, pk=request.data.get("user_id"))
        configured_username = settings.ADMIN_USERNAME
        if user.is_superuser or (
            configured_username
            and user.get_username().casefold() == configured_username.casefold()
        ):
            raise BadRequest("The configured admin account cannot be deleted.")
        try:
            user.delete()
        except ProtectedError as error:
            raise Conflict(
                "This user has related listings or order history and cannot be deleted."
            ) from error
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminOrderListView(AdminAPIView):
    def get(self, request):
        orders = Order.objects.select_related("book", "buyer", "seller").all()
        return Response(OrderSerializer(orders, many=True, context={"request": request}).data)


class AdminReportListView(AdminAPIView):
    def get(self, request):
        reports = Report.objects.select_related(
            "reporter", "reported_user", "book"
        ).all()
        return Response(ReportSerializer(reports, many=True, context={"request": request}).data)


class AdminReportDetailView(ReportDetailView):
    authentication_classes = [AdminJWTAuthentication]
    permission_classes = [IsAdminUser]
