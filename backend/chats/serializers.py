from rest_framework import serializers

from books.models import Book
from users.models import User

from .models import Chat


class ChatSerializer(serializers.ModelSerializer):
    book_id = serializers.PrimaryKeyRelatedField(
        source="book", queryset=Book.objects.all()
    )
    receiver_id = serializers.PrimaryKeyRelatedField(
        source="receiver", queryset=User.objects.filter(is_active=True)
    )
    sender_id = serializers.IntegerField(read_only=True)
    message = serializers.CharField(max_length=1000)
    book_title = serializers.CharField(source="book.title", read_only=True)
    sender_name = serializers.CharField(source="sender.full_name", read_only=True)
    receiver_name = serializers.CharField(source="receiver.full_name", read_only=True)

    class Meta:
        model = Chat
        fields = [
            "chat_id", "book_id", "sender_id", "receiver_id", "message", "sent_at",
            "is_read", "book_title", "sender_name", "receiver_name",
        ]
        read_only_fields = ["sent_at", "is_read"]

    def validate_message(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Message cannot be empty.")
        return value

    def validate(self, attrs):
        user = self.context["request"].user
        book = attrs["book"]
        receiver = attrs["receiver"]
        if receiver.pk == user.pk:
            raise serializers.ValidationError({"receiver_id": "You cannot message yourself."})
        if book.status not in Book.DETAIL_STATUSES and book.seller_id != user.pk:
            raise serializers.ValidationError(
                {"book_id": "You cannot chat about this listing."}
            )
        if user.pk != book.seller_id:
            if receiver.pk != book.seller_id:
                raise serializers.ValidationError(
                    {"receiver_id": "Buyers can only message the seller of this book."}
                )
        else:
            started = Chat.objects.filter(
                book=book, sender=receiver, receiver=user
            ).exists()
            if not started:
                raise serializers.ValidationError(
                    {"receiver_id": "This user has not contacted you about this book."}
                )
        return attrs
