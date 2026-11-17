from django.contrib import admin

from .models import Chat


if Chat in admin.site._registry:
    admin.site.unregister(Chat)
