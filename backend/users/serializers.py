import re

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "user_id", "full_name", "email", "phone", "city",
            "college_name", "department", "role", "phone_verified",
            "college_id_verified", "trust_score", "created_at",
        ]
        read_only_fields = fields


class RegisterSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(max_length=150)
    password = serializers.CharField(write_only=True, min_length=8)
    role = serializers.ChoiceField(choices=[("buyer", "Buyer"), ("seller", "Seller")])

    class Meta:
        model = User
        fields = [
            "user_id", "full_name", "email", "password", "phone",
            "city", "college_name", "department", "role", "created_at",
        ]
        read_only_fields = ["user_id", "created_at"]

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("This email is already registered.")
        return value

    def validate_phone(self, value):
        if value and not re.fullmatch(r"[6-9]\d{9}", value):
            raise serializers.ValidationError("Enter a valid 10-digit mobile number.")
        return value or None

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["full_name", "phone", "city", "college_name", "department"]

    def validate_phone(self, value):
        if value and not re.fullmatch(r"[6-9]\d{9}", value):
            raise serializers.ValidationError("Enter a valid 10-digit mobile number.")
        return value or None

    def update(self, instance, validated_data):
        if "phone" in validated_data and validated_data["phone"] != instance.phone:
            instance.phone_verified = False
        if (
            "college_name" in validated_data
            and validated_data["college_name"] != instance.college_name
        ):
            instance.college_id_verified = False
        return super().update(instance, validated_data)


class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "user_id", "full_name", "email", "phone", "city", "college_name",
            "department", "role", "phone_verified", "college_id_verified",
            "trust_score", "is_active", "is_blocked", "warning_message",
            "created_at",
        ]
        read_only_fields = [
            "user_id", "full_name", "email", "phone", "city", "college_name",
            "department", "trust_score", "created_at",
        ]

    def update(self, instance, validated_data):
        if validated_data.get("is_blocked") is False:
            validated_data["is_active"] = True
        return super().update(instance, validated_data)
