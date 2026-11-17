import os
import uuid

from django.core.files.storage import default_storage


def save_book_image(uploaded_file):
    extension = os.path.splitext(uploaded_file.name)[1].lower() or ".jpg"
    name = default_storage.save(f"books/{uuid.uuid4().hex}{extension}", uploaded_file)
    return default_storage.url(name)


def absolute_media_url(request, value):
    if not value:
        return None
    if value.startswith(("http://", "https://")) or request is None:
        return value
    return request.build_absolute_uri(value)
