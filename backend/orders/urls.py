from django.urls import path

from .views import (
    MyOrdersView,
    OrderDetailView,
    OrderListCreateView,
    RatingListCreateView,
    ReportDetailView,
    ReportListCreateView,
)

urlpatterns = [
    path("", OrderListCreateView.as_view(), name="orders"),
    path("my-orders/", MyOrdersView.as_view(), name="my-orders"),
    path("reports/", ReportListCreateView.as_view(), name="reports"),
    path("reports/<int:pk>/", ReportDetailView.as_view(), name="report-detail"),
    path("ratings/", RatingListCreateView.as_view(), name="ratings"),
    path("<int:pk>/", OrderDetailView.as_view(), name="order-detail"),
]
