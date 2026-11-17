from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q

class Book(models.Model):
    class Category(models.TextChoices):
        TEXTBOOK = "Textbook", "Textbook"
        NOTES = "Handwritten Notes", "Handwritten Notes"
        PAPERS = "Solved Question Papers", "Solved Question Papers"
        LAB = "Lab Manual", "Lab Manual"
        REFERENCE = "Reference Book", "Reference Book"
        OTHER = "Other", "Other"

    class Condition(models.TextChoices):
        NEW = "New", "New"
        LIKE_NEW = "Like New", "Like New"
        GOOD = "Good", "Good"
        ACCEPTABLE = "Acceptable", "Acceptable"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        AVAILABLE = "available", "Available"
        SOLD = "sold", "Sold"

    class Delivery(models.TextChoices):
        MEET = "meet", "Meet in person"
        COURIER = "courier", "Courier"

    class DeliveryTime(models.TextChoices):
        WITHIN_1_HOUR = "WITHIN_1_HOUR", "Within 1 hour"
        SAME_DAY = "SAME_DAY", "Same day"
        IN_2_DAYS = "IN_2_DAYS", "In 2 days"

    PUBLIC_STATUSES = ("approved", "available")
    DETAIL_STATUSES = ("approved", "available", "sold")

    book_id = models.AutoField(primary_key=True)
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column="seller_id",
        related_name="books",
    )
    title = models.CharField(max_length=200)
    author = models.CharField(max_length=150, null=True, blank=True)
    category = models.CharField(max_length=60, choices=Category.choices)
    subject = models.CharField(max_length=100)
    department = models.CharField(max_length=100)
    college_name = models.CharField(max_length=150)
    city = models.CharField(max_length=100)
    description = models.TextField()
    condition = models.CharField(max_length=30, choices=Condition.choices)
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    image_url = models.CharField(max_length=500, null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    rejection_reason = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    delivery_method = models.CharField(
        max_length=30, choices=Delivery.choices, default=Delivery.MEET
    )
    is_urgent = models.BooleanField(default=False)
    delivery_time = models.CharField(
        max_length=20, choices=DeliveryTime.choices, default=DeliveryTime.SAME_DAY
    )

    class Meta:
        db_table = "books"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "-created_at"], name="idx_book_status_created"),
            models.Index(fields=["city"], name="idx_book_city"),
            models.Index(fields=["college_name"], name="idx_book_college"),
            models.Index(fields=["department"], name="idx_book_department"),
            models.Index(fields=["category"], name="idx_book_category"),
            models.Index(fields=["price"], name="idx_book_price"),
        ]
        constraints = [
            models.CheckConstraint(check=models.Q(price__gt=0), name="book_price_positive"),
        ]

    def __str__(self):
        return f"{self.title} (₹{self.price}) – {self.status}"