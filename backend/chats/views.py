from django.db.models import Q
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated

from .models import Chat
from .serializers import ChatSerializer


def _int_param(request, name):
    raw = request.query_params.get(name)
    if raw in (None, ""):
        return None
    if not raw.isdigit():
        raise ValidationError({name: "Must be a number."})
    return int(raw)


class ChatListCreateView(generics.ListCreateAPIView):
    serializer_class = ChatSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        queryset = Chat.objects.filter(
            Q(sender=user) | Q(receiver=user)
        ).select_related("book", "sender", "receiver")
        book_id = _int_param(self.request, "book_id")
        other_user_id = _int_param(self.request, "user")
        if book_id:
            queryset = queryset.filter(book_id=book_id)
        if other_user_id:
            queryset = queryset.filter(
                Q(sender_id=other_user_id) | Q(receiver_id=other_user_id)
            )
        return queryset.order_by("sent_at")

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        book_id = _int_param(request, "book_id")
        other_user_id = _int_param(request, "user")
        if book_id and other_user_id:
            Chat.objects.filter(
                book_id=book_id,
                sender_id=other_user_id,
                receiver=request.user,
                is_read=False,
            ).update(is_read=True)
        return response

    def perform_create(self, serializer):
        serializer.save(sender=self.request.user)
