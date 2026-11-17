from django.shortcuts import get_object_or_404
from django.db import transaction
from django.db.models import Q
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from books.models import Book
from core.exceptions import BadRequest, Conflict
from core.permissions import IsAdminRole, is_admin

from .models import Order
from .models import Rating, Report
from .serializers import (
    OrderSerializer,
    OrderStatusSerializer,
    RatingSerializer,
    ReportSerializer,
)
from .services import change_order_status


class OrderListCreateView(generics.ListCreateAPIView):
    serializer_class = OrderSerializer
    pagination_class = None
    queryset = Order.objects.select_related("book", "buyer", "seller")

    def get_permissions(self):
        return [IsAdminRole()] if self.request.method == "GET" else [IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            book = Book.objects.select_for_update().get(
                pk=serializer.validated_data["book"].pk
            )
            if book.status == Book.Status.SOLD:
                raise BadRequest("This item has been sold.")
            if book.status not in Book.PUBLIC_STATUSES:
                raise BadRequest("This item is not available for order.")
            if book.seller_id == request.user.pk:
                raise BadRequest("You cannot order your own listing.")
            if Order.objects.filter(
                book=book,
                buyer=request.user,
                order_status__in=Order.ACTIVE_STATUSES,
            ).exists():
                raise Conflict("You already have an active order for this book.")
            order = serializer.save(
                book=book,
                buyer=request.user,
                seller=book.seller,
                agreed_price=book.price,
            )
        return Response(
            self.get_serializer(order).data,
            status=status.HTTP_201_CREATED,
        )

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.method == "GET" and is_admin(self.request.user):
            return queryset
        return queryset.none()


class MyOrdersView(generics.ListAPIView):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        queryset = Order.objects.select_related("book", "buyer", "seller")
        side = self.request.query_params.get("as")
        if side == "buyer":
            return queryset.filter(buyer=user)
        if side == "seller":
            return queryset.filter(seller=user)
        return queryset.filter(Q(buyer=user) | Q(seller=user))


class OrderDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        queryset = Order.objects.select_related("book", "buyer", "seller")
        return queryset if is_admin(user) else queryset.filter(
            Q(buyer=user) | Q(seller=user)
        )

    def get_serializer_class(self):
        if self.request.method == "PATCH":
            return OrderStatusSerializer
        return OrderSerializer

    def partial_update(self, request, *args, **kwargs):
        order = self.get_object()
        serializer = OrderStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        changes = serializer.validated_data
        if "order_status" in changes:
            if (
                changes["order_status"] == Order.Status.COMPLETED
                and order.delivery_method == Order.Delivery.COURIER
                and order.payment_before_pickup_status
                != Order.PickupPaymentStatus.RECEIVED
            ):
                raise BadRequest("Confirm payment before completing the order.")
            order = change_order_status(order, changes["order_status"], request.user)
            if (
                changes["order_status"] == Order.Status.COMPLETED
                and request.user.pk == order.seller_id
            ):
                order.delivery_status = Order.DeliveryStatus.DELIVERED
                order.save(update_fields=["delivery_status", "updated_at"])

        if "delivery_status" in changes or "payment_before_pickup_status" in changes:
            if request.user.pk != order.seller_id:
                raise BadRequest("Only the seller can update delivery and payment status.")
            delivery_status = changes.get("delivery_status")
            payment_received = (
                changes.get("payment_before_pickup_status")
                == Order.PickupPaymentStatus.RECEIVED
                or delivery_status == Order.DeliveryStatus.PAYMENT_RECEIVED
            )
            if payment_received:
                order.payment_before_pickup_status = Order.PickupPaymentStatus.RECEIVED
                order.payment_status = Order.PaymentStatus.PAID
                order.delivery_status = Order.DeliveryStatus.PAYMENT_RECEIVED
                order.save(
                    update_fields=[
                        "payment_before_pickup_status", "payment_status",
                        "delivery_status", "updated_at",
                    ]
                )
            if delivery_status:
                if (
                    delivery_status in (
                        Order.DeliveryStatus.PICKED_UP,
                        Order.DeliveryStatus.OUT_FOR_DELIVERY,
                        Order.DeliveryStatus.DELIVERED,
                    )
                    and order.payment_before_pickup_status
                    != Order.PickupPaymentStatus.RECEIVED
                ):
                    raise BadRequest("Seller must confirm payment before handing over the book.")
                if (
                    delivery_status == Order.DeliveryStatus.DELIVERED
                    and order.order_status != Order.Status.COMPLETED
                ):
                    order = change_order_status(
                        order, Order.Status.COMPLETED, request.user
                    )
                order.delivery_status = delivery_status
            if order.delivery_status == Order.DeliveryStatus.CANCELLED:
                order.order_status = Order.Status.CANCELLED
            order.save()
        return Response(OrderSerializer(order, context={"request": request}).data)


class ReportListCreateView(generics.ListCreateAPIView):
    serializer_class = ReportSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        queryset = Report.objects.select_related(
            "reporter", "reported_user", "book"
        )
        if is_admin(self.request.user):
            return queryset
        return queryset.filter(reporter=self.request.user)


class ReportDetailView(APIView):
    permission_classes = [IsAdminRole]

    def patch(self, request, pk):
        report = get_object_or_404(
            Report.objects.select_related("reported_user", "book"), pk=pk
        )
        action = request.data.get("action")
        if action == "reviewed":
            report.status = Report.Status.REVIEWED
        elif action == "warn":
            warning = str(request.data.get("warning_message", "")).strip()
            if not warning:
                raise BadRequest("A warning message is required.")
            report.reported_user.warning_message = warning
            report.reported_user.save(update_fields=["warning_message"])
            report.status = Report.Status.ACTION_TAKEN
        elif action == "block":
            report.reported_user.warning_message = str(
                request.data.get("warning_message", "Action taken after a user report.")
            ).strip()
            report.reported_user.is_blocked = True
            report.reported_user.is_active = False
            report.reported_user.save(
                update_fields=["warning_message", "is_blocked", "is_active"]
            )
            report.status = Report.Status.ACTION_TAKEN
        elif action == "delete_book":
            if report.book_id:
                book = report.book
                if book.orders.exists():
                    book.status = Book.Status.SOLD
                    book.save(update_fields=["status"])
                else:
                    book.delete()
            report.status = Report.Status.ACTION_TAKEN
        else:
            raise BadRequest("Choose reviewed, warn, block, or delete_book.")
        report.save(update_fields=["status"])
        return Response(ReportSerializer(report, context={"request": request}).data)


class RatingListCreateView(generics.ListCreateAPIView):
    serializer_class = RatingSerializer
    pagination_class = None

    def get_permissions(self):
        return [AllowAny()] if self.request.method == "GET" else [IsAuthenticated()]

    def get_queryset(self):
        queryset = Rating.objects.select_related("rater", "rated_user", "order")
        rated_user = self.request.query_params.get("rated_user")
        order_id = self.request.query_params.get("order_id")
        if rated_user:
            queryset = queryset.filter(rated_user_id=rated_user)
        if order_id:
            queryset = queryset.filter(order_id=order_id)
        return queryset
