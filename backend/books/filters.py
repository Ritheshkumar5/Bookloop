import django_filters

from .models import Book


class BookFilter(django_filters.FilterSet):
    city = django_filters.CharFilter(lookup_expr="icontains")
    department = django_filters.CharFilter(lookup_expr="icontains")
    college_name = django_filters.CharFilter(lookup_expr="icontains")
    category = django_filters.CharFilter(lookup_expr="iexact")
    condition = django_filters.CharFilter(lookup_expr="iexact")
    min_price = django_filters.NumberFilter(field_name="price", lookup_expr="gte")
    max_price = django_filters.NumberFilter(field_name="price", lookup_expr="lte")
    urgent_only = django_filters.BooleanFilter(field_name="is_urgent")
    same_city = django_filters.BooleanFilter(method="filter_same_city")

    def filter_same_city(self, queryset, name, value):
        if not value:
            return queryset
        city = getattr(self.request.user, "city", "")
        return queryset.filter(city__iexact=city) if city else queryset.none()

    class Meta:
        model = Book
        fields = [
            "city", "department", "college_name", "category",
            "condition", "min_price", "max_price", "urgent_only", "same_city",
        ]
