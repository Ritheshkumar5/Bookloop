from django.test import Client
from django.urls import reverse
from rest_framework.test import APITestCase

from books.models import Book
from users.models import User


class BookModerationTests(APITestCase):
    def setUp(self):
        self.seller = User.objects.create_user(
            email="seller@example.com",
            password="secure-password",
            full_name="Book Seller",
            city="Pune",
            college_name="Example College",
            department="Science",
            role=User.Role.SELLER,
        )
        self.admin = User.objects.create_user(
            email="admin@example.com",
            password="secure-password",
            full_name="Book Admin",
            city="Pune",
            college_name="Example College",
            department="Science",
            role=User.Role.ADMIN,
        )
        self.admin.is_superuser = True
        self.admin.save(update_fields=["is_superuser"])
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
        )
        self.url = reverse("book-detail", args=[self.book.pk])

    def test_admin_can_reject_with_reason(self):
        self.client.force_authenticate(self.admin)

        response = self.client.patch(
            self.url,
            {"status": Book.Status.REJECTED, "rejection_reason": "Photo is blurry."},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.book.refresh_from_db()
        self.assertEqual(self.book.status, Book.Status.REJECTED)
        self.assertEqual(self.book.rejection_reason, "Photo is blurry.")

    def test_seller_edit_resubmits_rejected_book_and_clears_reason(self):
        self.book.status = Book.Status.REJECTED
        self.book.rejection_reason = "Photo is blurry."
        self.book.save(update_fields=["status", "rejection_reason"])
        self.client.force_authenticate(self.seller)

        response = self.client.patch(
            self.url, {"title": "Updated textbook"}, format="json"
        )

        self.assertEqual(response.status_code, 200)
        self.book.refresh_from_db()
        self.assertEqual(self.book.status, Book.Status.PENDING)
        self.assertIsNone(self.book.rejection_reason)

    def test_admin_delete_can_block_seller_with_warning(self):
        self.client.force_authenticate(self.admin)

        response = self.client.delete(
            self.url,
            {"block_user": True, "warning_message": "Fraudulent listing."},
            format="json",
        )

        self.assertEqual(response.status_code, 204)
        self.seller.refresh_from_db()
        self.assertTrue(self.seller.is_blocked)
        self.assertFalse(self.seller.is_active)
        self.assertEqual(self.seller.warning_message, "Fraudulent listing.")

    def test_django_admin_reject_action_collects_a_reason(self):
        client = Client()
        client.force_login(self.admin)
        changelist = reverse("admin:books_book_changelist")
        selection = {
            "action": "reject",
            "_selected_action": [str(self.book.pk)],
            "index": "0",
            "select_across": "0",
        }

        confirmation = client.post(changelist, selection)

        self.assertContains(confirmation, "Rejection reason")
        result = client.post(
            changelist,
            {
                **selection,
                "confirm_reject": "yes",
                "reason": "Photo is blurry.",
            },
        )

        self.assertEqual(result.status_code, 302)
        self.book.refresh_from_db()
        self.assertEqual(self.book.status, Book.Status.REJECTED)
        self.assertEqual(self.book.rejection_reason, "Photo is blurry.")

    def test_django_admin_single_reject_button_saves_reason(self):
        client = Client()
        client.force_login(self.admin)
        change_url = reverse("admin:books_book_change", args=[self.book.pk])

        confirmation = client.get(change_url)

        self.assertContains(confirmation, "Reject listing")
        result = client.post(
            change_url,
            {
                "title": self.book.title,
                "author": self.book.author or "",
                "category": self.book.category,
                "subject": self.book.subject,
                "department": self.book.department,
                "college_name": self.book.college_name,
                "city": self.book.city,
                "description": self.book.description,
                "condition": self.book.condition,
                "price": str(self.book.price),
                "image_url": self.book.image_url or "",
                "seller": str(self.seller.pk),
                "status": self.book.status,
                "delivery_method": self.book.delivery_method,
                "rejection_reason": "Photo is blurry.",
                "_reject": "yes",
                "_save": "Save",
            },
        )

        self.assertEqual(result.status_code, 302)
        self.book.refresh_from_db()
        self.assertEqual(self.book.status, Book.Status.REJECTED)
        self.assertEqual(self.book.rejection_reason, "Photo is blurry.")

    def test_django_admin_shows_image_previews_on_list_and_edit_pages(self):
        self.book.image_url = "https://example.com/book.jpg"
        self.book.save(update_fields=["image_url"])
        client = Client()
        client.force_login(self.admin)

        listing = client.get(reverse("admin:books_book_changelist"))
        detail = client.get(reverse("admin:books_book_change", args=[self.book.pk]))

        self.assertContains(listing, 'width="80" height="80"')
        self.assertContains(listing, "https://example.com/book.jpg")
        self.assertContains(listing, 'href="https://example.com/book.jpg"')
        self.assertContains(listing, 'target="_blank"')
        self.assertContains(detail, 'width="300" height="300"')
        self.assertContains(detail, "https://example.com/book.jpg")
        self.assertContains(detail, 'href="https://example.com/book.jpg"')
        self.assertContains(detail, 'target="_blank"')

    def test_django_admin_delete_selected_can_block_sellers(self):
        client = Client()
        client.force_login(self.admin)
        changelist = reverse("admin:books_book_changelist")
        selection = {
            "action": "delete_selected",
            "_selected_action": [str(self.book.pk)],
            "index": "0",
        }

        confirmation = client.post(changelist, selection)

        self.assertContains(confirmation, "block their sellers")
        result = client.post(
            changelist,
            {
                **selection,
                "post": "yes",
                "block_user": "yes",
                "warning_message": "Fraudulent listing.",
            },
        )

        self.assertEqual(result.status_code, 302)
        self.assertFalse(Book.objects.filter(pk=self.book.pk).exists())
        self.seller.refresh_from_db()
        self.assertTrue(self.seller.is_blocked)
        self.assertFalse(self.seller.is_active)

    def test_django_admin_single_delete_can_block_seller(self):
        client = Client()
        client.force_login(self.admin)
        delete_url = reverse("admin:books_book_delete", args=[self.book.pk])

        confirmation = client.get(delete_url)

        self.assertContains(confirmation, "Delete this book and block this user")
        result = client.post(
            delete_url,
            {
                "post": "yes",
                "block_user": "yes",
                "warning_message": "Fraudulent listing.",
            },
        )

        self.assertEqual(result.status_code, 302)
        self.assertFalse(Book.objects.filter(pk=self.book.pk).exists())
        self.seller.refresh_from_db()
        self.assertTrue(self.seller.is_blocked)
        self.assertFalse(self.seller.is_active)
        self.assertEqual(self.seller.warning_message, "Fraudulent listing.")
