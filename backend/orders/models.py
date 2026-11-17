from django.conf import settings
from django.db import models
from django.core.validators import MaxValueValidator, MinValueValidator

def generate_rider_pickup_otp():
    # Kept only for old migration history. Not used anymore.
    return "0000"

def generate_tracking_id():
    # Kept only for old migration history. Not used anymore.
    return "00000000"


class Order(models.Model):
    class Delivery(models.TextChoices):
        MEET = "meet", "Meet in person"
        COURIER = "courier", "Courier"

    class Status(models.TextChoices):
        REQUESTED = "requested", "Requested"
        ACCEPTED = "accepted", "Accepted"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    class PaymentMethod(models.TextChoices):
        COD = "COD", "Cash on delivery"
        MEETUP = "MEETUP", "Pay on meetup"

    class PaymentStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PAID = "PAID", "Paid"

    class DeliveryStatus(models.TextChoices):
        CONFIRMED = "CONFIRMED", "Confirmed"
        DELIVERY_BOOKED = "DELIVERY_BOOKED", "Delivery booked"
        RIDER_ARRIVED = "RIDER_ARRIVED", "Rider arrived"
        PAYMENT_RECEIVED = "PAYMENT_RECEIVED", "Payment received"
        PICKED_UP = "PICKED_UP", "Picked up"
        OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY", "Out for delivery"
        DELIVERED = "DELIVERED", "Delivered"
        CANCELLED = "CANCELLED", "Cancelled"

    class PickupPaymentStatus(models.TextChoices):
        NOT_RECEIVED = "NOT_RECEIVED", "Not received"
        RECEIVED = "RECEIVED", "Received"

    ACTIVE_STATUSES = ("requested", "accepted")

    order_id = models.AutoField(primary_key=True)
    book = models.ForeignKey(
        "books.Book", on_delete=models.PROTECT, db_column="book_id", related_name="orders"
    )
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column="buyer_id",
        related_name="orders_as_buyer",
    )
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column="seller_id",
        related_name="orders_as_seller",
    )
    order_date = models.DateTimeField(auto_now_add=True)
    agreed_price = models.DecimalField(max_digits=10, decimal_places=2)
    delivery_method = models.CharField(max_length=30, choices=Delivery.choices)
    delivery_address = models.TextField(null=True, blank=True)
    payment_method = models.CharField(
        max_length=10, choices=PaymentMethod.choices, default=PaymentMethod.COD
    )
    payment_status = models.CharField(
        max_length=10, choices=PaymentStatus.choices, default=PaymentStatus.PENDING
    )
    delivery_status = models.CharField(
        max_length=24, choices=DeliveryStatus.choices, default=DeliveryStatus.CONFIRMED
    )
    is_urgent = models.BooleanField(default=False)
    payment_before_pickup_status = models.CharField(
        max_length=12,
        choices=PickupPaymentStatus.choices,
        default=PickupPaymentStatus.NOT_RECEIVED,
    )
    order_status = models.CharField(
        max_length=30, choices=Status.choices, default=Status.REQUESTED
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "orders"
        ordering = ["-order_date"]
        indexes = [
            models.Index(fields=["buyer", "-order_date"], name="idx_order_buyer"),
            models.Index(fields=["seller", "-order_date"], name="idx_order_seller"),
            models.Index(fields=["order_status"], name="idx_order_status"),
        ]

    def __str__(self):
        return f"Order #{self.order_id} – {self.book_id} – {self.order_status}"

class Report(models.Model):
    class Reason(models.TextChoices):
        TOOK_MONEY_NO_BOOK = "TOOK_MONEY_NO_BOOK", "Took money, no book"
        FAKE_BOOK = "FAKE_BOOK", "Fake book"
        WRONG_BOOK = "WRONG_BOOK", "Wrong book"
        ABUSIVE_CHAT = "ABUSIVE_CHAT", "Abusive chat"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        REVIEWED = "REVIEWED", "Reviewed"
        ACTION_TAKEN = "ACTION_TAKEN", "Action taken"

    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="reports_made"
    )
    reported_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="reports_received"
    )
    book = models.ForeignKey(
        "books.Book", on_delete=models.SET_NULL, null=True, blank=True, related_name="reports"
    )
    reason = models.CharField(max_length=32, choices=Reason.choices)
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

class Rating(models.Model):
    order = models.OneToOneField(
        Order, on_delete=models.CASCADE, related_name="rating"
    )
    rater = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="ratings_made"
    )
    rated_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="ratings_received"
    )
    stars = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                check=models.Q(stars__gte=1, stars__lte=5),
                name="rating_stars_1_to_5",
            )
        ]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        average = self.rated_user.ratings_received.aggregate(
            average=models.Avg("stars")
        )["average"]
        self.rated_user.trust_score = average or 0
        self.rated_user.save(update_fields=["trust_score"])