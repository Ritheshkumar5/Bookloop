from django.db.models import Q
from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.exceptions import NotAuthenticated, PermissionDenied, ValidationError
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from core.exceptions import Conflict
from core.permissions import IsOwnerOrAdmin, is_admin
from users.authentication import SoftJWTAuthentication

from .filters import BookFilter
from .models import Book
from .serializers import BookSerializer

VALID_STATUSES = {value for value, _ in Book.Status.choices}

def visible_books(user):
    queryset = Book.objects.select_related("seller")
    if is_admin(user):
        return queryset
    visibility = Q(status__in=Book.DETAIL_STATUSES)
    if user.is_authenticated:
        visibility |= Q(seller=user)
    return queryset.filter(visibility)

class BookViewSet(viewsets.ModelViewSet):
    serializer_class = BookSerializer
    authentication_classes = [SoftJWTAuthentication]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = BookFilter
    search_fields = ["title", "author", "subject", "description"]
    ordering_fields = ["price", "created_at"]
    ordering = ["-created_at"]
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        if self.action == "create":
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsOwnerOrAdmin()]

    def get_queryset(self):
        user = self.request.user
        queryset = Book.objects.select_related("seller")
        if self.action != "list":
            return visible_books(user)

        params = self.request.query_params
        wanted = params.get("status")
        if params.get("seller") == "me" or params.get("mine") == "true":
            if not user.is_authenticated:
                raise NotAuthenticated()
            queryset = queryset.filter(seller=user)
            return queryset.filter(status=wanted) if wanted in VALID_STATUSES else queryset
        if is_admin(user):
            return queryset.filter(status=wanted) if wanted in VALID_STATUSES else queryset
        return queryset.filter(status__in=Book.PUBLIC_STATUSES)

    def perform_create(self, serializer):
        serializer.save(seller=self.request.user)

    def destroy(self, request, *args, **kwargs):
        book = self.get_object()
        if book.orders.exists():
            raise Conflict(
                "This listing has order history and cannot be deleted. Mark it as SOLD instead."
            )
        block_user = request.data.get("block_user", False)
        if isinstance(block_user, str):
            block_user = block_user.lower() in ("true", "1", "yes")
        if block_user and not is_admin(request.user):
            raise PermissionDenied("Only an admin can block a seller.")
        warning_message = str(request.data.get("warning_message", "")).strip()
        if block_user and not warning_message:
            raise ValidationError("Enter a warning reason before blocking this seller.")

        with transaction.atomic():
            seller = book.seller
            book.delete()
            if block_user:
                seller.is_blocked = True
                seller.is_active = False
                seller.warning_message = warning_message
                seller.save(update_fields=["is_blocked", "is_active", "warning_message"])
        return Response(status=status.HTTP_204_NO_CONTENT)
