from rest_framework import serializers

from books.models import Book
from books.utils import absolute_media_url
from users.models import User

from .models import Order, Rating, Report

class OrderSerializer(serializers.ModelSerializer):
    book_id = serializers.PrimaryKeyRelatedField(source="book", queryset=Book.objects.all())
    buyer_id = serializers.IntegerField(read_only=True)
    seller_id = serializers.IntegerField(read_only=True)
    book_title = serializers.CharField(source="book.title", read_only=True)
    book_image_url = serializers.SerializerMethodField()
    buyer_name = serializers.CharField(source="buyer.full_name", read_only=True)
    seller_name = serializers.CharField(source="seller.full_name", read_only=True)
    buyer_phone = serializers.CharField(source="buyer.phone", read_only=True)
    seller_phone = serializers.CharField(source="seller.phone", read_only=True)

    class Meta:
        model = Order
        fields = [
            "order_id", "book_id", "buyer_id", "seller_id", "book_title",
            "book_image_url", "buyer_name", "seller_name", "buyer_phone",
            "seller_phone", "order_date", "agreed_price", "delivery_method",
            "delivery_address", "order_status", "payment_method", "payment_status",
            "delivery_status",
            "payment_before_pickup_status", "is_urgent",
            "updated_at",
        ]
        read_only_fields = [
            "agreed_price", "order_status", "order_date", "updated_at",
            "payment_status", "delivery_status",
            "payment_before_pickup_status",
        ]

    def get_book_image_url(self, obj):
        return absolute_media_url(self.context.get("request"), obj.book.image_url)

    def validate(self, attrs):
        method = attrs.get("delivery_method", getattr(self.instance, "delivery_method", None))
        if method == Order.Delivery.COURIER:
            address = (
                attrs.get("delivery_address")
                or getattr(self.instance, "delivery_address", "")
                or ""
            ).strip()
            if not address:
                raise serializers.ValidationError(
                    {"delivery_address": "Delivery address is required for courier."}
                )
            attrs["delivery_address"] = address
        elif method == Order.Delivery.MEET:
            attrs["delivery_address"] = None
        return attrs

class OrderStatusSerializer(serializers.Serializer):
    order_status = serializers.ChoiceField(
        choices=Order.Status.choices, required=False
    )
    delivery_status = serializers.ChoiceField(
        choices=Order.DeliveryStatus.choices, required=False
    )
    payment_before_pickup_status = serializers.ChoiceField(
        choices=Order.PickupPaymentStatus.choices, required=False
    )

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError("Provide an order or delivery status.")
        return attrs

class ReportSerializer(serializers.ModelSerializer):
    reported_user_id = serializers.PrimaryKeyRelatedField(
        source="reported_user", queryset=User.objects.all()
    )
    reporter_id = serializers.IntegerField(read_only=True)
    reporter_name = serializers.CharField(source="reporter.full_name", read_only=True)
    reported_user_name = serializers.CharField(
        source="reported_user.full_name", read_only=True
    )
    book_title = serializers.CharField(source="book.title", read_only=True, allow_null=True)

    class Meta:
        model = Report
        fields = [
            "id", "reporter_id", "reporter_name", "reported_user_id",
            "reported_user_name", "book", "book_title", "reason",
            "description", "status", "created_at",
        ]
        read_only_fields = ["id", "status", "created_at"]

    def validate(self, attrs):
        request = self.context["request"]
        reported_user = attrs["reported_user"]
        book = attrs.get("book")
        if request.user.pk == reported_user.pk:
            raise serializers.ValidationError("You cannot report yourself.")
        if not book or book.seller_id != reported_user.pk:
            raise serializers.ValidationError(
                {"book": "Choose a listing belonging to the reported seller."}
            )
        if not Order.objects.filter(
            buyer=request.user,
            seller=reported_user,
            book=book,
            delivery_status=Order.DeliveryStatus.DELIVERED,
        ).exists():
            raise serializers.ValidationError(
                "You can report a seller only after a delivered order for this book."
            )
        return attrs

    def create(self, validated_data):
        return Report.objects.create(reporter=self.context["request"].user, **validated_data)

class RatingSerializer(serializers.ModelSerializer):
    order_id = serializers.PrimaryKeyRelatedField(
        source="order", queryset=Order.objects.select_related("buyer", "seller").all()
    )
    rater_id = serializers.IntegerField(read_only=True)
    rated_user_name = serializers.CharField(
        source="rated_user.full_name", read_only=True
    )

    class Meta:
        model = Rating
        fields = [
            "id", "order_id", "rater_id", "rated_user_name", "stars",
            "comment", "created_at",
        ]
        read_only_fields = ["id", "created_at"]
        extra_kwargs = {
            "stars": {"min_value": 1, "max_value": 5},
        }

    def validate(self, attrs):
        order = attrs["order"]
        request = self.context["request"]
        if order.buyer_id != request.user.pk:
            raise serializers.ValidationError("Only the buyer can rate this order.")
        if order.delivery_status != Order.DeliveryStatus.DELIVERED:
            raise serializers.ValidationError("You can rate only after delivery.")
        return attrs

    def create(self, validated_data):
        order = validated_data["order"]
        return Rating.objects.create(
            rater=self.context["request"].user,
            rated_user=order.seller,
            **validated_data,
        )