from django.contrib import admin

from .models import Order, Rating, Report

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("order_id", "book", "buyer", "status")
    list_filter = ("order_status",)
    search_fields = ("book__title", "buyer__email", "seller__email")
    readonly_fields = tuple(
        field.name for field in Order._meta.fields if field.name != "order_status"
    )

    @admin.display(description="Status", ordering="order_status")
    def status(self, obj):
        return obj.order_status

@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ("book", "reported_by", "reason")

    @admin.display(description="Reported by", ordering="reporter__email")
    def reported_by(self, obj):
        return obj.reporter

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

@admin.register(Rating)
class RatingAdmin(admin.ModelAdmin):
    list_display = ("book", "user", "stars")

    @admin.display(description="Book", ordering="order__book__title")
    def book(self, obj):
        return obj.order.book

    @admin.display(description="User", ordering="rater__email")
    def user(self, obj):
        return obj.rater

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False