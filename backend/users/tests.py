from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.test import override_settings
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APITestCase

from users.models import User


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    FRONTEND_URL="https://bookloop.example",
)
class PasswordResetRequestTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="reset@example.com",
            password="secure-password",
            full_name="Reset User",
            city="Pune",
            college_name="Example College",
            department="Science",
        )

    def test_password_reset_is_public_and_does_not_disclose_unknown_emails(self):
        existing_response = self.client.post(
            reverse("password_reset_api"),
            {"email": self.user.email},
            format="json",
        )
        missing_response = self.client.post(
            reverse("password_reset_api"),
            {"email": "missing@example.com"},
            format="json",
        )

        self.assertEqual(existing_response.status_code, 200)
        self.assertEqual(missing_response.status_code, 200)
        self.assertEqual(existing_response.data, missing_response.data)
        self.assertEqual(
            existing_response.data["detail"],
            "If an account exists, a reset link has been sent",
        )
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(
            "https://bookloop.example/reset-password/",
            mail.outbox[0].body,
        )


class PasswordResetConfirmTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="confirm-reset@example.com",
            password="OriginalPassword9!",
            full_name="Reset User",
            city="Pune",
            college_name="Example College",
            department="Science",
        )
        self.uidb64 = urlsafe_base64_encode(force_bytes(self.user.pk))
        self.token = default_token_generator.make_token(self.user)
        self.url = reverse(
            "password_reset_confirm_api",
            kwargs={"uidb64": self.uidb64, "token": self.token},
        )

    def test_valid_reset_token_can_be_checked_and_used_once(self):
        check_response = self.client.get(self.url)
        reset_response = self.client.post(
            self.url,
            {
                "new_password1": "NewBookLoopPassword9!",
                "new_password2": "NewBookLoopPassword9!",
            },
            format="json",
        )

        self.user.refresh_from_db()
        self.assertEqual(check_response.status_code, 200)
        self.assertEqual(reset_response.status_code, 200)
        self.assertTrue(self.user.check_password("NewBookLoopPassword9!"))
        self.assertEqual(self.client.get(self.url).status_code, 400)

    def test_invalid_token_cannot_change_password(self):
        url = reverse(
            "password_reset_confirm_api",
            kwargs={"uidb64": self.uidb64, "token": "invalid-token"},
        )
        response = self.client.post(
            url,
            {
                "new_password1": "NewBookLoopPassword9!",
                "new_password2": "NewBookLoopPassword9!",
            },
            format="json",
        )

        self.user.refresh_from_db()
        self.assertEqual(response.status_code, 400)
        self.assertTrue(self.user.check_password("OriginalPassword9!"))


class BlockedUserLoginTests(APITestCase):
    def test_blocked_user_login_returns_admin_warning(self):
        User.objects.create_user(
            email="blocked@example.com",
            password="secure-password",
            full_name="Blocked User",
            city="Pune",
            college_name="Example College",
            department="Science",
            is_blocked=True,
            is_active=False,
            warning_message="Fraudulent listing.",
        )

        response = self.client.post(
            reverse("login"),
            {"email": "blocked@example.com", "password": "secure-password"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.data["detail"],
            "Your account is blocked: Fraudulent listing. Contact Admin.",
        )
