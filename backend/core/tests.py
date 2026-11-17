from rest_framework.test import APITestCase
from django.test import override_settings
from rest_framework_simplejwt.tokens import AccessToken

from books.models import Book
from users.models import User


class BookLoopAPITests(APITestCase):
    def setUp(self):
        self.seller = User.objects.create_user(
            email="seller@example.com",
            password="SellerPass123!",
            full_name="Book Seller",
            city="Chennai",
            college_name="Example University",
            department="Computer Science",
            role="seller",
        )
        self.buyer = User.objects.create_user(
            email="buyer@example.com",
            password="BuyerPass123!",
            full_name="Book Buyer",
            city="Delhi",
            college_name="Other University",
            department="Physics",
            role="buyer",
        )
        self.other_buyer = User.objects.create_user(
            email="other@example.com",
            password="OtherPass123!",
            full_name="Another Buyer",
            city="Pune",
            college_name="Third University",
            department="Maths",
            role="buyer",
        )
        self.admin = User.objects.create_superuser(
            email="admin@example.com",
            password="AdminPass123!",
            full_name="Platform Admin",
            city="Mumbai",
            college_name="BookLoop",
            department="Administration",
        )

    def listing_data(self):
        return {
            "title": "Introduction to Algorithms",
            "author": "T. Cormen",
            "category": "Textbook",
            "subject": "Algorithms",
            "department": "Computer Science",
            "college_name": "Example University",
            "city": "Chennai",
            "description": "Good condition, lightly used for one semester.",
            "condition": "Good",
            "price": "450.00",
            "delivery_method": "meet",
        }

    def create_approved_book(self):
        book = Book.objects.create(
            seller=self.seller,
            status=Book.Status.APPROVED,
            **self.listing_data(),
        )
        return book

    def test_registration_hashes_password_and_returns_jwt_on_login(self):
        response = self.client.post(
            "/api/users/register/",
            {
                "full_name": "New Student",
                "email": "new@example.com",
                "password": "NewStudentPass2026!",
                "phone": "9876543210",
                "city": "Jaipur",
                "college_name": "New University",
                "department": "Biology",
                "role": "buyer",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        student = User.objects.get(email="new@example.com")
        self.assertNotEqual(student.password, "NewStudentPass2026!")
        login = self.client.post(
            "/api/users/login/",
            {"email": "new@example.com", "password": "NewStudentPass2026!"},
            format="json",
        )
        self.assertEqual(login.status_code, 200)
        self.assertIn("access", login.data)
        self.assertEqual(login.data["user"]["user_id"], student.user_id)

    def test_owner_listing_approval_and_public_visibility(self):
        self.client.force_authenticate(self.seller)
        created = self.client.post("/api/books/", self.listing_data(), format="json")
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data["status"], Book.Status.PENDING)
        book_id = created.data["book_id"]

        self.client.force_authenticate(self.admin)
        approved = self.client.patch(
            f"/api/books/{book_id}/", {"status": "approved"}, format="json"
        )
        self.assertEqual(approved.status_code, 200)

        self.client.force_authenticate(self.other_buyer)
        denied = self.client.patch(
            f"/api/books/{book_id}/", {"price": "20.00"}, format="json"
        )
        self.assertEqual(denied.status_code, 403)

        self.client.force_authenticate(self.seller)
        updated = self.client.patch(
            f"/api/books/{book_id}/", {"price": "400.00"}, format="json"
        )
        self.assertEqual(updated.status_code, 200)
        sold = self.client.patch(
            f"/api/books/{book_id}/", {"status": "sold"}, format="json"
        )
        self.assertEqual(sold.status_code, 200)

        self.client.force_authenticate(None)
        explore = self.client.get("/api/books/")
        self.assertEqual(explore.status_code, 200)
        self.assertEqual(explore.data["count"], 0)
        self.assertEqual(self.client.get(f"/api/books/{book_id}/").status_code, 200)

    def test_order_transitions_cancel_other_requests_and_chat_is_private(self):
        book = self.create_approved_book()
        self.client.force_authenticate(self.buyer)
        first_order = self.client.post(
            "/api/orders/",
            {"book_id": book.book_id, "delivery_method": "meet"},
            format="json",
        )
        self.assertEqual(first_order.status_code, 201)
        duplicate = self.client.post(
            "/api/orders/",
            {"book_id": book.book_id, "delivery_method": "meet"},
            format="json",
        )
        self.assertEqual(duplicate.status_code, 409)

        first_message = self.client.post(
            "/api/chats/",
            {
                "book_id": book.book_id,
                "receiver_id": self.seller.user_id,
                "message": "Is this book still available?",
            },
            format="json",
        )
        self.assertEqual(first_message.status_code, 201)
        self.client.force_authenticate(self.other_buyer)
        private_messages = self.client.get(
            f"/api/chats/?book_id={book.book_id}&user={self.buyer.user_id}"
        )
        self.assertEqual(private_messages.status_code, 200)
        self.assertEqual(private_messages.data, [])

        second_order = self.client.post(
            "/api/orders/",
            {"book_id": book.book_id, "delivery_method": "meet"},
            format="json",
        )
        self.assertEqual(second_order.status_code, 201)
        self.client.force_authenticate(self.seller)
        accepted = self.client.patch(
            f"/api/orders/{first_order.data['order_id']}/",
            {"order_status": "accepted"},
            format="json",
        )
        self.assertEqual(accepted.status_code, 200)
        completed = self.client.patch(
            f"/api/orders/{first_order.data['order_id']}/",
            {"order_status": "completed"},
            format="json",
        )
        self.assertEqual(completed.status_code, 200)
        book.refresh_from_db()
        self.assertEqual(book.status, Book.Status.SOLD)
        self.assertEqual(
            book.orders.get(order_id=second_order.data["order_id"]).order_status,
            "cancelled",
        )


@override_settings(
    ADMIN_USERNAME="site-admin@example.com",
    ADMIN_PASSWORD="test-admin-pass",
)
class AdminAPITests(APITestCase):
    def setUp(self):
        self.seller = User.objects.create_user(
            email="admin-api-seller@example.com",
            password="SellerPass123!",
            full_name="Admin API Seller",
            city="Delhi",
            college_name="Example University",
            department="Science",
            role="seller",
        )
        self.book = Book.objects.create(
            seller=self.seller,
            title="Pending test book",
            category=Book.Category.TEXTBOOK,
            subject="Science",
            department="Science",
            college_name="Example University",
            city="Delhi",
            description="A book awaiting admin approval.",
            condition=Book.Condition.GOOD,
            price="100.00",
        )

    def test_admin_login_returns_one_hour_admin_jwt_and_allows_approval(self):
        login = self.client.post(
            "/api/admin/login/",
            {"username": "site-admin@example.com", "password": "test-admin-pass"},
            format="json",
        )

        self.assertEqual(login.status_code, 200)
        self.assertTrue(login.data["is_admin"])
        token = AccessToken(login.data["access"])
        self.assertEqual(int(token["exp"]) - int(token["iat"]), 3600)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        pending = self.client.get("/api/admin/pending-books/")
        self.assertEqual(pending.status_code, 200)
        self.assertEqual([item["book_id"] for item in pending.data], [self.book.pk])

        approved = self.client.post(
            "/api/admin/approve-book/",
            {"book_id": self.book.pk},
            format="json",
        )
        self.assertEqual(approved.status_code, 200)
        self.book.refresh_from_db()
        self.assertEqual(self.book.status, Book.Status.APPROVED)

    def test_admin_login_rejects_bad_credentials_and_admin_api_requires_admin(self):
        denied = self.client.post(
            "/api/admin/login/",
            {"username": "site-admin@example.com", "password": "wrong"},
            format="json",
        )
        self.assertEqual(denied.status_code, 401)
        self.assertEqual(self.client.get("/api/admin/users/").status_code, 401)

        user = User.objects.create_user(
            email="regular@example.com",
            password="RegularPass123!",
            full_name="Regular User",
            city="Delhi",
            college_name="Example University",
            department="Science",
            role="buyer",
        )
        self.client.force_authenticate(user=user)
        self.assertEqual(self.client.get("/api/admin/users/").status_code, 403)

        role_admin = User.objects.create_user(
            email="role-admin@example.com",
            password="RoleAdminPass123!",
            full_name="Role-only Admin",
            city="Delhi",
            college_name="Example University",
            department="Science",
            role="admin",
        )
        self.client.force_authenticate(user=role_admin)
        self.assertEqual(self.client.get("/api/admin/users/").status_code, 403)

    def test_configured_django_user_can_authenticate_admin_apis(self):
        configured_admin = User.objects.create_user(
            email="site-admin@example.com",
            password="ConfiguredPass123!",
            full_name="Configured Admin",
            city="Delhi",
            college_name="BookLoop",
            department="Administration",
        )
        login = self.client.post(
            "/api/users/login/",
            {"email": configured_admin.email, "password": "ConfiguredPass123!"},
            format="json",
        )
        self.assertEqual(login.status_code, 200)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        self.assertEqual(self.client.get("/api/admin/users/").status_code, 200)
