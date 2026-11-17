from django.db import transaction
from django.utils import timezone

from books.models import Book
from core.exceptions import BadRequest

from .models import Order

TRANSITIONS = {
    "requested": {
        "accepted": {"seller"},
        "cancelled": {"buyer", "seller"},
    },
    "accepted": {
        "completed": {"seller"},
        "cancelled": {"buyer", "seller"},
    },
}


@transaction.atomic
def change_order_status(order, new_status, user):
    order = Order.objects.select_for_update().get(pk=order.pk)
    if user.role != "admin":
        role = "seller" if user.pk == order.seller_id else "buyer"
        allowed = TRANSITIONS.get(order.order_status, {}).get(new_status, set())
        if role not in allowed:
            raise BadRequest(
                f"You cannot change this order from '{order.order_status}' to '{new_status}'."
            )

    order.order_status = new_status
    order.save()
    if new_status == Order.Status.COMPLETED:
        book = Book.objects.select_for_update().get(pk=order.book_id)
        book.status = Book.Status.SOLD
        book.save(update_fields=["status"])
        Order.objects.filter(
            book=book, order_status__in=Order.ACTIVE_STATUSES
        ).exclude(pk=order.pk).update(
            order_status=Order.Status.CANCELLED, updated_at=timezone.now()
        )
    return order
