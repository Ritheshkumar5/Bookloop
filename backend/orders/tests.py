from rest_framework.test import APITestCase

from books.models import Book
from orders.models import Order
from users.models import User


class OrderSafetyFeatureTests(APITestCase):
    def setUp(self):
        self.buyer = User.objects.create_user(
            email="buyer@example.com",
            password="ComplexPass123!",
            full_name="Book Buyer",
            city="Pune",
            college_name="Example College",
            department="Science",
            role=User.Role.BUYER,
        )
        self.seller = User.objects.create_user(
            email="seller@example.com",
            password="ComplexPass123!",
            full_name="Book Seller",
            city="Pune",
            college_name="Example College",
            department="Science",
            role=User.Role.SELLER,
        )
        self.book = Book.objects.create(
            seller=self.seller,
            title="Example textbook",
            category=Book.Category.TEXTBOOK,
            subject="Science",
            department="Science",
            college_name="Example College",
            city="Pune",
            description="A textbook in good condition.",
            condition=Book.Condition.GOOD,
            price="100.00",
            status=Book.Status.AVAILABLE,
        )
        self.order = Order.objects.create(
            book=self.book,
            buyer=self.buyer,
            seller=self.seller,
            agreed_price=self.book.price,
            delivery_method=Order.Delivery.COURIER,
            delivery_address="1 College Road",
        )

    def test_seller_must_confirm_payment_before_pickup_and_buyer_can_rate_after_delivery(self):
        self.client.force_authenticate(self.seller)
        accepted = self.client.patch(
            f"/api/orders/{self.order.pk}/",
            {"order_status": "accepted"},
            format="json",
        )
        self.assertEqual(accepted.status_code, 200)

        arrived = self.client.patch(
            f"/api/orders/{self.order.pk}/",
            {"delivery_status": "RIDER_ARRIVED"},
            format="json",
        )
        self.assertEqual(arrived.status_code, 200)
        denied_pickup = self.client.patch(
            f"/api/orders/{self.order.pk}/",
            {"delivery_status": "PICKED_UP"},
            format="json",
        )
        self.assertEqual(denied_pickup.status_code, 400)

        paid = self.client.patch(
            f"/api/orders/{self.order.pk}/",
            {"payment_before_pickup_status": "RECEIVED"},
            format="json",
        )
        self.assertEqual(paid.status_code, 200)
        self.assertEqual(paid.data["payment_status"], Order.PaymentStatus.PAID)
        self.assertEqual(len(paid.data["rider_pickup_otp"]), 4)

        self.client.patch(
            f"/api/orders/{self.order.pk}/",
            {"delivery_status": "PICKED_UP"},
            format="json",
        )
        delivered = self.client.patch(
            f"/api/orders/{self.order.pk}/",
            {"delivery_status": "DELIVERED"},
            format="json",
        )
        self.assertEqual(delivered.status_code, 200)

        self.client.force_authenticate(self.buyer)
        rating = self.client.post(
            "/api/orders/ratings/",
            {"order_id": self.order.pk, "stars": 5, "comment": "Great seller."},
            format="json",
        )
        self.assertEqual(rating.status_code, 201)
        self.seller.refresh_from_db()
        self.assertEqual(self.seller.trust_score, 5.0)

        report = self.client.post(
            "/api/orders/reports/",
            {
                "reported_user_id": self.seller.pk,
                "book": self.book.pk,
                "reason": "WRONG_BOOK",
                "description": "Description for the report.",
            },
            format="json",
        )
        self.assertEqual(report.status_code, 201)

    def test_only_seller_can_update_delivery_and_payment_fields(self):
        self.client.force_authenticate(self.buyer)
        response = self.client.patch(
            f"/api/orders/{self.order.pk}/",
            {"delivery_status": "RIDER_ARRIVED"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_report_and_rating_require_a_delivered_order(self):
        self.client.force_authenticate(self.buyer)
        report = self.client.post(
            "/api/orders/reports/",
            {
                "reported_user_id": self.seller.pk,
                "book": self.book.pk,
                "reason": "FAKE_BOOK",
            },
            format="json",
        )
        rating = self.client.post(
            "/api/orders/ratings/",
            {"order_id": self.order.pk, "stars": 1},
            format="json",
        )
        self.assertEqual(report.status_code, 400)
        self.assertEqual(rating.status_code, 400)
