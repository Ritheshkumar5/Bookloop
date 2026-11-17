from django.conf import settings
from django.db import models
from django.db.models import F, Q


class Chat(models.Model):
    chat_id = models.AutoField(primary_key=True)
    book = models.ForeignKey(
        "books.Book", on_delete=models.CASCADE, db_column="book_id", related_name="chats"
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        db_column="sender_id",
        related_name="sent_messages",
    )
    receiver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        db_column="receiver_id",
        related_name="received_messages",
    )
    message = models.TextField()
    sent_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        db_table = "chats"
        ordering = ["sent_at"]
        indexes = [
            models.Index(fields=["book", "sent_at"], name="idx_chat_book_time"),
            models.Index(fields=["sender", "receiver"], name="idx_chat_pair"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=~Q(sender=F("receiver")),
                name="chat_no_self_message",
            ),
        ]

    def __str__(self):
        return (
            f"Chat {self.chat_id}: {self.sender_id} → {self.receiver_id} "
            f"(book {self.book_id})"
        )
