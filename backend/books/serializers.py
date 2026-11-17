from rest_framework import serializers

from core.exceptions import BadRequest
from core.permissions import is_admin
from .models import Book
from .utils import absolute_media_url, save_book_image

MAX_IMAGE_BYTES = 2 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}


class SellerMiniSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    full_name = serializers.CharField()
    city = serializers.CharField()
    college_name = serializers.CharField()
    phone = serializers.CharField(allow_null=True)
    phone_verified = serializers.BooleanField()
    college_id_verified = serializers.BooleanField()
    trust_score = serializers.FloatField()
    average_rating = serializers.FloatField(source="trust_score")


class BookSerializer(serializers.ModelSerializer):
    book_id = serializers.IntegerField(read_only=True)
    seller_id = serializers.IntegerField(read_only=True)
    seller = SellerMiniSerializer(read_only=True)
    image = serializers.ImageField(write_only=True, required=False)
    image_url = serializers.CharField(
        required=False, allow_null=True, allow_blank=True, max_length=500
    )
    status = serializers.ChoiceField(choices=Book.Status.choices, required=False)

    class Meta:
        model = Book
        fields = [
            "book_id", "seller_id", "seller", "title", "author", "category", "subject",
            "department", "college_name", "city", "description", "condition", "price",
            "image", "image_url", "delivery_method", "status", "rejection_reason",
            "created_at", "is_urgent", "delivery_time",
        ]
        read_only_fields = ["created_at"]

    def validate_title(self, value):
        value = value.strip()
        if len(value) < 3:
            raise serializers.ValidationError("Title must be at least 3 characters.")
        return value

    def validate_description(self, value):
        value = value.strip()
        if len(value) < 10:
            raise serializers.ValidationError("Add a short description (min 10 characters).")
        return value

    def validate_image(self, image):
        if image.content_type not in ALLOWED_IMAGE_TYPES:
            raise serializers.ValidationError("Only JPG, PNG or WEBP images are allowed.")
        if image.size > MAX_IMAGE_BYTES:
            raise serializers.ValidationError("Image must be smaller than 2 MB.")
        return image

    def validate_image_url(self, value):
        if value and not value.lower().startswith(("http://", "https://")):
            raise serializers.ValidationError("image_url must start with http:// or https://")
        return value or None

    def validate_status(self, value):
        user = self.context["request"].user
        if is_admin(user):
            return value
        if self.instance is None or value == self.instance.status:
            return value
        if value != Book.Status.SOLD:
            raise serializers.ValidationError("Only an admin can change the status to this value.")
        if self.instance.status not in Book.PUBLIC_STATUSES:
            raise serializers.ValidationError("Only an approved listing can be marked as SOLD.")
        return value

    def validate_rejection_reason(self, value):
        if not is_admin(self.context["request"].user):
            raise serializers.ValidationError("Only an admin can set a rejection reason.")
        return value

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["image_url"] = absolute_media_url(
            self.context.get("request"), instance.image_url
        )
        return data

    def create(self, validated_data):
        image = validated_data.pop("image", None)
        if image:
            validated_data["image_url"] = save_book_image(image)
        validated_data["status"] = (
            Book.Status.AVAILABLE
            if is_admin(self.context["request"].user)
            else Book.Status.PENDING
        )
        return super().create(validated_data)

    def update(self, instance, validated_data):
        user = self.context["request"].user
        admin = is_admin(user)
        if instance.status == Book.Status.SOLD and not admin:
            raise BadRequest("Sold listings cannot be edited.")

        image = validated_data.pop("image", None)
        if image:
            validated_data["image_url"] = save_book_image(image)
        new_status = validated_data.get("status")
        if not admin and instance.status == Book.Status.REJECTED:
            validated_data["status"] = Book.Status.PENDING
            validated_data["rejection_reason"] = None

        book = super().update(instance, validated_data)
        if new_status == Book.Status.SOLD:
            book.orders.filter(order_status__in=("requested", "accepted")).update(
                order_status="cancelled"
            )
        return book
