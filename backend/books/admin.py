from django import forms
from django.contrib import admin, messages
from django.contrib.admin.actions import delete_selected as default_delete_selected
from django.contrib.admin.helpers import ACTION_CHECKBOX_NAME
from django.db import transaction
from django.http import HttpResponseRedirect
from django.shortcuts import render
from django.utils.html import format_html
from django.urls import reverse

from users.models import User

from .models import Book


class RejectBooksForm(forms.Form):
    reason = forms.CharField(
        label="Rejection reason",
        widget=forms.Textarea(attrs={"rows": 4}),
        max_length=10000,
    )


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ("title", "owner", "price", "is_available")
    list_filter = ("status", "category", "city", "department")
    search_fields = ("title", "seller__email")
    delete_confirmation_template = "admin/books/book/delete_confirmation.html"
    change_form_template = "admin/books/book/change_form.html"
    delete_selected_confirmation_template = (
        "admin/books/book/delete_selected_confirmation.html"
    )
    readonly_fields = ("image_detail_preview", "rejection_reason", "created_at")
    fieldsets = (
        (None, {
            "fields": (
                "seller", "title", "author", "category", "subject", "department",
                "college_name", "city", "description", "condition", "price",
                "image_detail_preview", "image_url", "status", "rejection_reason",
                "created_at", "delivery_method",
            )
        }),
    )
    actions = ["approve", "reject", "delete_selected"]

    @admin.display(description="Owner", ordering="seller__email")
    def owner(self, obj):
        return format_html("{}<br>{}", self.image_preview(obj), obj.seller)

    @admin.display(description="Available", boolean=True)
    def is_available(self, obj):
        return obj.status in Book.PUBLIC_STATUSES

    @admin.display(description="Image")
    def image_preview(self, obj):
        if not obj.image_url:
            return format_html('<span style="color: red;">No Image</span>')
        return format_html(
            '<a href="{}" target="_blank" rel="noopener noreferrer">'
            '<img src="{}" width="80" height="80" '
            'style="object-fit:cover; border-radius:8px;" /></a>',
            obj.image_url,
            obj.image_url,
        )

    @admin.display(description="Image preview")
    def image_detail_preview(self, obj):
        if not obj.image_url:
            return format_html('<span style="color: red;">No Image</span>')
        return format_html(
            '<a href="{}" target="_blank" rel="noopener noreferrer">'
            '<img src="{}" width="300" height="300" '
            'style="object-fit:cover; border-radius:8px;" /></a>',
            obj.image_url,
            obj.image_url,
        )

    @admin.action(description="Approve selected listings")
    def approve(self, request, queryset):
        queryset.filter(status=Book.Status.PENDING).update(status=Book.Status.APPROVED)

    @admin.action(description="Reject selected listings")
    def reject(self, request, queryset):
        if request.POST.get("confirm_reject") == "yes":
            form = RejectBooksForm(request.POST)
            if form.is_valid():
                updated = queryset.filter(status=Book.Status.PENDING).update(
                    status=Book.Status.REJECTED,
                    rejection_reason=form.cleaned_data["reason"],
                )
                self.message_user(
                    request, f"{updated} listing(s) rejected.", messages.SUCCESS
                )
                return None
        else:
            form = RejectBooksForm()

        return render(
            request,
            "admin/books/book/reject_selected.html",
            {
                **self.admin_site.each_context(request),
                "opts": self.model._meta,
                "queryset": queryset,
                "form": form,
                "action_checkbox_name": ACTION_CHECKBOX_NAME,
                "select_across": request.POST.get("select_across", "0"),
            },
        )

    @admin.action(description="Delete selected listings")
    def delete_selected(self, request, queryset):
        if request.POST.get("post") == "yes":
            block_user = request.POST.get("block_user") == "yes"
            warning_message = request.POST.get("warning_message", "").strip()
            if block_user and not warning_message:
                self.message_user(
                    request,
                    "Enter a warning reason before blocking sellers.",
                    messages.ERROR,
                )
                return HttpResponseRedirect(request.get_full_path())
        return default_delete_selected(self, request, queryset)

    def delete_view(self, request, object_id, extra_context=None):
        if (
            request.method == "POST"
            and request.POST.get("post") == "yes"
            and request.POST.get("block_user") == "yes"
            and not request.POST.get("warning_message", "").strip()
        ):
            self.message_user(
                request,
                "Enter a warning reason before blocking this seller.",
                messages.ERROR,
            )
            return HttpResponseRedirect(
                reverse("admin:books_book_delete", args=[object_id])
            )
        return super().delete_view(request, object_id, extra_context)

    def delete_model(self, request, obj):
        seller = obj.seller
        with transaction.atomic():
            super().delete_model(request, obj)
            if request.POST.get("block_user") == "yes":
                seller.is_blocked = True
                seller.is_active = False
                seller.warning_message = request.POST["warning_message"].strip()
                seller.save(
                    update_fields=["is_blocked", "is_active", "warning_message"]
                )

    def response_change(self, request, obj):
        if "_reject" in request.POST:
            reason = request.POST.get("rejection_reason", "").strip()
            if obj.status != Book.Status.PENDING:
                self.message_user(
                    request,
                    "Only pending listings can be rejected.",
                    messages.ERROR,
                )
            elif not reason:
                self.message_user(
                    request, "Enter a rejection reason.", messages.ERROR
                )
            else:
                obj.status = Book.Status.REJECTED
                obj.rejection_reason = reason
                obj.save(update_fields=["status", "rejection_reason"])
                self.message_user(request, "Listing rejected.", messages.SUCCESS)
            return HttpResponseRedirect(
                reverse("admin:books_book_change", args=[obj.pk])
            )
        return super().response_change(request, obj)

    def delete_queryset(self, request, queryset):
        seller_ids = list(queryset.values_list("seller_id", flat=True).distinct())
        with transaction.atomic():
            super().delete_queryset(request, queryset)
            if request.POST.get("block_user") == "yes":
                User.objects.filter(user_id__in=seller_ids).update(
                    is_blocked=True,
                    is_active=False,
                    warning_message=request.POST["warning_message"].strip(),
                )
