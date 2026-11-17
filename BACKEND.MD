# BookLoop – Backend Build Guide (BACKEND.md)

> **BookLoop – One Book, Many Readers!**
> A Global Book Resale Platform for College Students in India
> **Backend:** Python 3.x · Django · Django REST Framework · MySQL · JWT  |  **Frontend (separate):** React.js

This file is a step-by-step build guide for the BookLoop backend. A developer should be able to follow it from top to bottom and end up with a working REST API that the React frontend (see `FRONTEND.md`) can call directly. Table names, column names, roles, statuses and endpoint paths come from the SRS (Sections 7 and 8).

---

## Table of Contents

1. [Project Overview & Architecture](#1-project-overview--architecture)
2. [Setup & Folder Structure](#2-setup--folder-structure)
3. [Database Design (Models)](#3-database-design-models)
4. [API Endpoints](#4-api-endpoints)
5. [CRUD Operations Flow & Business Rules](#5-crud-operations-flow--business-rules)
6. [Authentication & Permissions](#6-authentication--permissions)
7. [Admin Features](#7-admin-features)
8. [Settings (MySQL, CORS, MEDIA, JWT)](#8-settings-mysql-cors-media-jwt)
9. [Testing](#9-testing)
10. [Step-by-Step Build Order](#10-step-by-step-build-order)
11. [Frontend Contract (what React expects)](#11-frontend-contract-what-react-expects)
12. [Final Checklist](#12-final-checklist)

---

## 1. Project Overview & Architecture

**BookLoop** lets college students buy and sell used educational materials – textbooks, handwritten notes, solved question papers, lab manuals and reference books.

**Global, not one college.** The backend must never restrict listings to one institution. `college_name`, `city` and `department` are plain searchable attributes on every book, so a student in Chennai can buy a book listed by a student in Delhi.

### 1.1 Three-layer architecture (SRS Section 7)

```
┌──────────────────────┐   HTTP + JSON    ┌──────────────────────────┐   ORM    ┌─────────────┐
│  PRESENTATION LAYER  │ ───────────────► │    APPLICATION LAYER     │ ───────► │ DATA LAYER  │
│  React.js, JS,       │   (JWT in the    │  Django + DRF            │          │  MySQL      │
│  HTML, CSS           │ ◄─────────────── │  (this document)         │ ◄─────── │             │
└──────────────────────┘   Authorization  └──────────────────────────┘          └─────────────┘
                               header
```

| Layer | Technology | Responsibility |
|---|---|---|
| Presentation | React.js, JavaScript, HTML, CSS | Pages, forms, search results, dashboards; sends API requests, shows responses |
| **Application (this file)** | Python, Django, Django REST Framework | Authenticates users, validates data, enforces permissions and business rules, exposes REST endpoints |
| Data | MySQL | Persistent storage for users, books, orders, chats |

### 1.2 Request & data flow (SRS 7.2)

1. React sends an HTTP request (GET / POST / PUT / PATCH / DELETE) to a DRF endpoint, with `Authorization: Bearer <access>` on protected calls.
2. Django middleware runs (CORS, security).
3. DRF **authenticates** the JWT and runs the view's **permission classes**.
4. The **serializer** validates the input.
5. The **view / service code** applies business rules (e.g. "a sold book cannot be ordered").
6. The **Django ORM** reads or writes MySQL.
7. DRF returns JSON with a proper HTTP status code. React updates the UI.

### 1.3 Roles (SRS 2.3)

| `users.role` | Who | Backend rights |
|---|---|---|
| `buyer` | Junior student | Browse, order, chat |
| `seller` | Senior student | Everything a buyer can + create / edit / delete own listings, mark SOLD |
| `admin` | Platform manager | Approve / reject / remove any listing, manage and suspend users, view all orders |

> Any logged-in student (buyer or seller) can both buy and sell, because real students do both. `role` is used mainly to identify **admins**. Only `admin` is hard-restricted. (If your viva requires strict roles, add one line to `BookViewSet.get_permissions` – noted in Section 6.)

### 1.4 Design rules

- **Backend is the source of truth.** Every rule (ownership, sold items, suspended users) is enforced here even if React also hides the button.
- **Passwords are never stored in plain text** – Django's password hashing only.
- **All input is validated** by serializers; all permissions are checked in permission classes.
- **Consistent errors:** business-rule errors return `{"detail": "message"}`; field errors return `{"field": ["message"]}` (DRF default) – the React `getErrorMessage()` / `getFieldErrors()` helpers rely on this.

### 1.5 Out of scope (SRS 3.4 and 9)

Online payments, courier tracking, ratings, wishlist, notifications, college verification, mobile app, recommendations.

---

## 2. Setup & Folder Structure

### 2.1 Prerequisites

- Python 3.10+ (3.x as per SRS)
- MySQL 8.0.16+ (CHECK constraints are enforced from 8.0.16)
- VS Code, MySQL Workbench, Postman (SRS Section 5)

### 2.2 Create the project

```bash
mkdir bookloop_backend && cd bookloop_backend
python -m venv venv
# Windows: venv\Scripts\activate      Mac/Linux: source venv/bin/activate

pip install -r requirements.txt          # see 2.3 (create the file first)

django-admin startproject bookloop_backend .      # note the trailing dot
python manage.py startapp core
python manage.py startapp users
python manage.py startapp books
python manage.py startapp orders
python manage.py startapp chats
```

### 2.3 `requirements.txt`

```text
Django>=5.1,<6.0
djangorestframework>=3.15
djangorestframework-simplejwt>=5.3
django-cors-headers>=4.3
django-filter>=24.1
mysqlclient>=2.2
Pillow>=10.0
python-decouple>=3.8
```

> **Windows + `mysqlclient` fails to install?** Use `pip install PyMySQL` instead and add these two lines at the top of `bookloop_backend/__init__.py`:
> ```python
> import pymysql
> pymysql.install_as_MySQLdb()
> ```

### 2.4 Folder structure

```
bookloop_backend/                      ← repository root
├── manage.py
├── requirements.txt
├── .env                               ← secrets (never commit)
├── .env.example
├── .gitignore                         ← venv/, .env, media/, __pycache__/
│
├── bookloop_backend/                  ← project configuration package
│   ├── __init__.py
│   ├── settings.py                    ← MySQL, CORS, MEDIA, JWT (Section 8)
│   ├── urls.py                        ← root URL router
│   ├── asgi.py
│   └── wsgi.py
│
├── core/                              ← shared helpers (no models)
│   ├── exceptions.py                  ← BadRequest, Conflict
│   ├── pagination.py                  ← StandardPagination
│   └── permissions.py                 ← IsAdminRole, IsOwnerOrAdmin, is_admin()
│
├── users/                             ← Users table, auth endpoints
│   ├── models.py                      ← User (custom), UserManager
│   ├── serializers.py
│   ├── views.py
│   ├── authentication.py              ← SoftJWTAuthentication
│   ├── urls.py
│   ├── admin.py
│   └── tests.py
│
├── books/                             ← Books table, listings CRUD
│   ├── models.py
│   ├── serializers.py
│   ├── filters.py                     ← search / filter backend
│   ├── views.py
│   ├── utils.py                       ← image saving, absolute URL helper
│   ├── urls.py
│   ├── admin.py
│   └── tests.py
│
├── orders/                            ← Orders table
│   ├── models.py
│   ├── serializers.py
│   ├── services.py                    ← status transitions
│   ├── views.py
│   ├── urls.py
│   ├── admin.py
│   └── tests.py
│
├── chats/                             ← Chats table
│   ├── models.py
│   ├── serializers.py
│   ├── views.py
│   ├── urls.py
│   ├── admin.py
│   └── tests.py
│
└── media/                             ← uploaded book images (auto-created)
    └── books/
```

### 2.5 Shared helpers

**`core/exceptions.py`** – business-rule errors that return `{"detail": "..."}` (what the React error helper reads).

```python
from rest_framework import status
from rest_framework.exceptions import APIException


class BadRequest(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Invalid request."
    default_code = "bad_request"


class Conflict(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "This action conflicts with the current state."
    default_code = "conflict"
```

**`core/pagination.py`**

```python
from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    page_size = 12                      # matches PAGE_SIZE in the React app
    page_size_query_param = "page_size"
    max_page_size = 50
```

**`core/permissions.py`**

```python
from rest_framework.permissions import BasePermission


def is_admin(user) -> bool:
    return bool(user and user.is_authenticated and user.role == "admin")


class IsAdminRole(BasePermission):
    """Only users whose role is 'admin'."""
    message = "Admin access only."

    def has_permission(self, request, view):
        return is_admin(request.user)


class IsOwnerOrAdmin(BasePermission):
    """Object-level: the listing's seller, or an admin."""
    message = "You can only modify your own listings."

    def has_object_permission(self, request, view, obj):
        return is_admin(request.user) or obj.seller_id == request.user.pk
```

---

## 3. Database Design (Models)

The four tables below are the **exact SRS Section 8 tables**. `db_table` is set explicitly so MySQL shows `users`, `books`, `orders`, `chats` (not `users_user`, etc.), and the primary keys are named `user_id`, `book_id`, `order_id`, `chat_id`.

### 3.1 Relationships (SRS 8.5)

```
            ┌───────────────┐
            │     users     │
            │  (user_id PK) │
            └───┬───┬───┬───┘
  seller_id     │   │   │  buyer_id / seller_id / sender_id / receiver_id
      ┌─────────┘   │   └───────────────┐
      ▼             ▼                   ▼
┌───────────┐  ┌───────────┐       ┌───────────┐
│   books   │◄─│  orders   │       │   chats   │
│ (book_id) │  │ (order_id)│       │ (chat_id) │
└─────┬─────┘  └───────────┘       └─────┬─────┘
      └──────────── book_id FK ──────────┘
```

- One user → many books (`books.seller_id`).
- One buyer → many orders (`orders.buyer_id`); one seller → many orders (`orders.seller_id`).
- One book → many orders over its life, and many chat messages (`chats.book_id`).
- A user sends and receives many chats (`chats.sender_id`, `chats.receiver_id`).

### 3.2 Install order (important)

`AUTH_USER_MODEL = "users.User"` **must be set before the first `migrate`**, otherwise Django creates its default `auth_user` table and switching later is painful. Follow Section 10 in order.

### 3.3 `users/models.py` – Users table

| SRS column | Django field | MySQL type |
|---|---|---|
| user_id | `AutoField(primary_key=True)` | INT AUTO_INCREMENT PK |
| full_name | `CharField(100)` | VARCHAR(100) |
| email | `EmailField(150, unique=True)` | VARCHAR(150) UNIQUE |
| password | `CharField(255)` (hash) | VARCHAR(255) |
| phone | `CharField(20, null=True)` | VARCHAR(20) NULL |
| city | `CharField(100)` | VARCHAR(100) |
| college_name | `CharField(150)` | VARCHAR(150) |
| department | `CharField(100)` | VARCHAR(100) |
| role | `CharField(20, choices)` | VARCHAR(20) |
| created_at | `DateTimeField(auto_now_add)` | DATETIME |

Extra technical columns (needed by Django auth / suspension, not business data): `is_active` (False = **suspended**), `is_staff`, `is_superuser`, `last_login`.

> **Why a custom user model?** The SRS says Django's built-in auth tables may be used instead of a fully custom table. Extending `AbstractBaseUser` gives us the exact SRS columns **and** Django's password hashing, login checks and admin integration.

```python
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError("Email is required.")
        email = self.normalize_email(email).lower()
        extra.setdefault("role", "buyer")
        user = self.model(email=email, **extra)
        user.set_password(password)          # hashes the password (PBKDF2)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("role", "admin")
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        BUYER = "buyer", "Buyer"
        SELLER = "seller", "Seller"
        ADMIN = "admin", "Admin"

    user_id = models.AutoField(primary_key=True)
    full_name = models.CharField(max_length=100)
    email = models.EmailField(max_length=150, unique=True)
    # Override Django's default 128 so the column matches SRS VARCHAR(255)
    password = models.CharField(max_length=255)
    phone = models.CharField(max_length=20, null=True, blank=True)
    city = models.CharField(max_length=100)
    college_name = models.CharField(max_length=150)
    department = models.CharField(max_length=100)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.BUYER)
    created_at = models.DateTimeField(auto_now_add=True)

    is_active = models.BooleanField(default=True)    # False = suspended by admin
    is_staff = models.BooleanField(default=False)    # access to /admin/ site

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name", "city", "college_name", "department"]

    class Meta:
        db_table = "users"
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if self.role == self.Role.ADMIN:
            self.is_staff = True                     # admins can open Django admin
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.full_name} <{self.email}>"
```

### 3.4 `books/models.py` – Books table

| SRS column | Django field | MySQL type |
|---|---|---|
| book_id | `AutoField(primary_key=True)` | INT AUTO_INCREMENT PK |
| seller_id | `ForeignKey(User, db_column="seller_id")` | INT FK → users.user_id |
| title | `CharField(200)` | VARCHAR(200) |
| author | `CharField(150, null=True)` | VARCHAR(150) NULL |
| category | `CharField(60, choices)` | VARCHAR(60) |
| subject | `CharField(100)` | VARCHAR(100) |
| department | `CharField(100)` | VARCHAR(100) |
| college_name | `CharField(150)` | VARCHAR(150) |
| city | `CharField(100)` | VARCHAR(100) |
| description | `TextField` | TEXT |
| condition | `CharField(30, choices)` | VARCHAR(30) |
| price | `DecimalField(10, 2)` | DECIMAL(10,2) |
| image_url | `CharField(500, null=True)` | VARCHAR(500) NULL |
| status | `CharField(20, choices)` | VARCHAR(20) |
| created_at | `DateTimeField(auto_now_add)` | DATETIME |
| *delivery_method* (extension) | `CharField(30, choices, default="meet")` | VARCHAR(30) |

> **Extension beyond the SRS table:** the SRS keeps `delivery_method` in **Orders** only. The React Sell form also collects the seller's preferred handover method, so we add one optional column to Books (`delivery_method`, default `meet`). It is only a preference that pre-fills the order form; the binding value is still `orders.delivery_method`. Remove the field if your guide insists on the 15 exact columns – the API keeps working (the serializer ignores the missing field).
>
> **Note:** `condition` is a *reserved word* in MySQL. Django back-quotes column names automatically, so it works – but if you write raw SQL in Workbench, write `` `condition` ``.

```python
from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q


class Book(models.Model):
    class Category(models.TextChoices):
        TEXTBOOK = "Textbook", "Textbook"
        NOTES = "Handwritten Notes", "Handwritten Notes"
        PAPERS = "Solved Question Papers", "Solved Question Papers"
        LAB = "Lab Manual", "Lab Manual"
        REFERENCE = "Reference Book", "Reference Book"
        OTHER = "Other", "Other"                      # SRS: other permitted materials

    class Condition(models.TextChoices):
        NEW = "New", "New"
        LIKE_NEW = "Like New", "Like New"
        GOOD = "Good", "Good"
        ACCEPTABLE = "Acceptable", "Acceptable"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"                # just submitted, waits for admin
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        AVAILABLE = "available", "Available"
        SOLD = "sold", "Sold"

    class Delivery(models.TextChoices):
        MEET = "meet", "Meet in person"
        COURIER = "courier", "Courier"

    # Statuses a buyer can see in Explore AND can order
    PUBLIC_STATUSES = ("approved", "available")
    # Statuses anyone may open on the detail page (sold items are shown as SOLD)
    DETAIL_STATUSES = ("approved", "available", "sold")

    book_id = models.AutoField(primary_key=True)
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column="seller_id",
        related_name="books",
    )
    title = models.CharField(max_length=200)
    author = models.CharField(max_length=150, null=True, blank=True)
    category = models.CharField(max_length=60, choices=Category.choices)
    subject = models.CharField(max_length=100)
    department = models.CharField(max_length=100)
    college_name = models.CharField(max_length=150)
    city = models.CharField(max_length=100)
    description = models.TextField()
    condition = models.CharField(max_length=30, choices=Condition.choices)
    price = models.DecimalField(
        max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    image_url = models.CharField(max_length=500, null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    # --- extension (see note above) ---
    delivery_method = models.CharField(max_length=30, choices=Delivery.choices, default=Delivery.MEET)

    class Meta:
        db_table = "books"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "-created_at"], name="idx_book_status_created"),
            models.Index(fields=["city"], name="idx_book_city"),
            models.Index(fields=["college_name"], name="idx_book_college"),
            models.Index(fields=["department"], name="idx_book_department"),
            models.Index(fields=["category"], name="idx_book_category"),
            models.Index(fields=["price"], name="idx_book_price"),
        ]
        constraints = [
            models.CheckConstraint(condition=Q(price__gt=0), name="book_price_positive"),
        ]

    def __str__(self):
        return f"{self.title} (₹{self.price}) – {self.status}"
```

### 3.5 `orders/models.py` – Orders table

| SRS column | Django field | MySQL type |
|---|---|---|
| order_id | `AutoField(primary_key=True)` | INT AUTO_INCREMENT PK |
| book_id | `ForeignKey(Book, db_column="book_id")` | INT FK → books.book_id |
| buyer_id | `ForeignKey(User, db_column="buyer_id")` | INT FK → users.user_id |
| seller_id | `ForeignKey(User, db_column="seller_id")` | INT FK → users.user_id |
| order_date | `DateTimeField(auto_now_add)` | DATETIME |
| agreed_price | `DecimalField(10, 2)` | DECIMAL(10,2) |
| delivery_method | `CharField(30, choices)` | VARCHAR(30) |
| delivery_address | `TextField(null=True)` | TEXT NULL |
| order_status | `CharField(30, choices)` | VARCHAR(30) |
| updated_at | `DateTimeField(auto_now)` | DATETIME |

`on_delete=PROTECT` keeps order history safe (SRS 3.6: "retain the order and listing history").

```python
from django.conf import settings
from django.db import models


class Order(models.Model):
    class Delivery(models.TextChoices):
        MEET = "meet", "Meet in person"
        COURIER = "courier", "Courier"

    class Status(models.TextChoices):
        REQUESTED = "requested", "Requested"
        ACCEPTED = "accepted", "Accepted"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    ACTIVE_STATUSES = ("requested", "accepted")

    order_id = models.AutoField(primary_key=True)
    book = models.ForeignKey(
        "books.Book", on_delete=models.PROTECT, db_column="book_id", related_name="orders"
    )
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        db_column="buyer_id", related_name="orders_as_buyer",
    )
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        db_column="seller_id", related_name="orders_as_seller",
    )
    order_date = models.DateTimeField(auto_now_add=True)
    agreed_price = models.DecimalField(max_digits=10, decimal_places=2)
    delivery_method = models.CharField(max_length=30, choices=Delivery.choices)
    delivery_address = models.TextField(null=True, blank=True)   # only for courier
    order_status = models.CharField(
        max_length=30, choices=Status.choices, default=Status.REQUESTED
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "orders"
        ordering = ["-order_date"]
        indexes = [
            models.Index(fields=["buyer", "-order_date"], name="idx_order_buyer"),
            models.Index(fields=["seller", "-order_date"], name="idx_order_seller"),
            models.Index(fields=["order_status"], name="idx_order_status"),
        ]

    def __str__(self):
        return f"Order #{self.order_id} – {self.book_id} – {self.order_status}"
```

### 3.6 `chats/models.py` – Chats table

| SRS column | Django field | MySQL type |
|---|---|---|
| chat_id | `AutoField(primary_key=True)` | INT AUTO_INCREMENT PK |
| book_id | `ForeignKey(Book, db_column="book_id")` | INT FK → books.book_id |
| sender_id | `ForeignKey(User, db_column="sender_id")` | INT FK → users.user_id |
| receiver_id | `ForeignKey(User, db_column="receiver_id")` | INT FK → users.user_id |
| message | `TextField` | TEXT |
| sent_at | `DateTimeField(auto_now_add)` | DATETIME |
| is_read | `BooleanField(default=False)` | TINYINT(1) |

```python
from django.conf import settings
from django.db import models
from django.db.models import F, Q


class Chat(models.Model):
    chat_id = models.AutoField(primary_key=True)
    book = models.ForeignKey(
        "books.Book", on_delete=models.CASCADE, db_column="book_id", related_name="chats"
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        db_column="sender_id", related_name="sent_messages",
    )
    receiver = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        db_column="receiver_id", related_name="received_messages",
    )
    message = models.TextField()
    sent_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        db_table = "chats"
        ordering = ["sent_at"]
        indexes = [
            models.Index(fields=["book", "sent_at"], name="idx_chat_book_time"),
            models.Index(fields=["sender", "receiver"], name="idx_chat_pair"),
        ]
        constraints = [
            models.CheckConstraint(condition=~Q(sender=F("receiver")), name="chat_no_self_message"),
        ]

    def __str__(self):
        return f"Chat {self.chat_id}: {self.sender_id} → {self.receiver_id} (book {self.book_id})"
```

> **Larger design (SRS note):** a separate `Conversations` table could group messages into threads. We skip it – a conversation is simply the set of chats with the same `book_id` and the same two users, which is exactly how the React `ChatList` groups them.

### 3.7 Migrations

```bash
python manage.py makemigrations users books orders chats
python manage.py migrate
```

---

## 4. API Endpoints

### 4.0 Conventions

| Item | Value |
|---|---|
| Base URL (dev) | `http://127.0.0.1:8000` |
| Format | JSON (`Content-Type: application/json`) – except book create/update, which accepts `multipart/form-data` (for the image) **or** JSON |
| Auth header | `Authorization: Bearer <access_token>` |
| Datetimes | ISO 8601 with +05:30 offset (`USE_TZ=True`, `TIME_ZONE="Asia/Kolkata"`) |
| Decimals | Returned as strings, e.g. `"450.00"` |
| Pagination (books) | `{ "count", "next", "previous", "results": [...] }`, 12 per page, `?page=2`, optional `?page_size=` (max 50) |
| Field error | `400 { "price": ["A valid number is required."] }` |
| Business-rule error | `400/403/404/409 { "detail": "This item has been sold." }` |

**Common status codes**

| Code | Meaning in BookLoop |
|---|---|
| 200 | OK |
| 201 | Created |
| 204 | Deleted (no body) |
| 400 | Validation or business-rule error |
| 401 | Missing / invalid / expired token, wrong login |
| 403 | Logged in but not allowed (not the owner, not admin, suspended on login) |
| 404 | Not found (or hidden from you) |
| 409 | Conflict (e.g. delete a listing that has orders, duplicate active order) |
| 429 | Too many login attempts |

### 4.1 Endpoint summary

**SRS Section 7.4 endpoints**

| # | Purpose | Method | Endpoint | Auth |
|---|---|---|---|---|
| 1 | Register | POST | `/api/users/register/` | No |
| 2 | Login | POST | `/api/users/login/` | No |
| 3 | List / search books | GET | `/api/books/` | No (optional) |
| 4 | Create listing | POST | `/api/books/` | **Yes** |
| 5 | View book details | GET | `/api/books/{id}/` | No (optional) |
| 6 | Update listing | PUT / PATCH | `/api/books/{id}/` | **Yes** (owner/admin) |
| 7 | Delete listing | DELETE | `/api/books/{id}/` | **Yes** (owner/admin) |
| 8 | Create order | POST | `/api/orders/` | **Yes** |
| 9 | My orders | GET | `/api/orders/my-orders/` | **Yes** |
| 10 | View chats | GET | `/api/chats/` | **Yes** |
| 11 | Send chat | POST | `/api/chats/` | **Yes** |

**Supporting endpoints (needed by SRS functional requirements and by the React app)**

| # | Purpose | Method | Endpoint | Auth |
|---|---|---|---|---|
| 12 | Refresh access token | POST | `/api/users/token/refresh/` | No (refresh token in body) |
| 13 | Logout (blacklist refresh token) | POST | `/api/users/logout/` | **Yes** |
| 14 | View / update my profile (SRS 3.1) | GET / PATCH | `/api/users/me/` | **Yes** |
| 15 | List users (admin, SRS 3.7) | GET | `/api/users/` | **Admin** |
| 16 | Suspend / activate user (admin) | PATCH | `/api/users/{id}/` | **Admin** |
| 17 | Update order status | PATCH | `/api/orders/{id}/` | **Yes** (buyer/seller/admin) |
| 18 | All orders (admin, SRS 3.7) | GET | `/api/orders/` | **Admin** |

> Endpoint paths are "illustrative" in the SRS and may be adjusted; the React app (`FRONTEND.md`) uses exactly the paths above.

---

### 4.2 Users

#### 4.2.1 `POST /api/users/register/`

| | |
|---|---|
| Auth | No |
| Purpose | Create a new account (SRS 3.1) |

**Request body**

```json
{
  "full_name": "Ravi Kumar",
  "email": "ravi@example.com",
  "password": "StrongPass123",
  "phone": "9876543210",
  "city": "Chennai",
  "college_name": "Anna University",
  "department": "CSE",
  "role": "seller"
}
```

Rules: `phone` optional (`^[6-9]\d{9}$`); `role` must be `buyer` or `seller` (never `admin`); password ≥ 8 chars and passes Django's validators; email unique (case-insensitive). The frontend's `confirm_password` is *not* sent.

**Response `201 Created`**

```json
{
  "user_id": 3,
  "full_name": "Ravi Kumar",
  "email": "ravi@example.com",
  "phone": "9876543210",
  "city": "Chennai",
  "college_name": "Anna University",
  "department": "CSE",
  "role": "seller",
  "created_at": "2026-11-11T09:30:00+05:30"
}
```

| Status | When |
|---|---|
| 201 | Account created |
| 400 | Missing/invalid field, e.g. `{"email": ["This email is already registered."]}` |

**Serializer + view**

```python
# users/serializers.py
import re

from django.contrib.auth.password_validation import validate_password as django_validate_password
from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    """Read-only representation used in login and profile responses."""
    class Meta:
        model = User
        fields = ["user_id", "full_name", "email", "phone", "city",
                  "college_name", "department", "role", "created_at"]
        read_only_fields = fields


class RegisterSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(max_length=150)          # no auto UniqueValidator, we word the message
    password = serializers.CharField(write_only=True, min_length=8, style={"input_type": "password"})
    role = serializers.ChoiceField(choices=[("buyer", "buyer"), ("seller", "seller")])

    class Meta:
        model = User
        fields = ["user_id", "full_name", "email", "password", "phone",
                  "city", "college_name", "department", "role", "created_at"]
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
        django_validate_password(value)                      # Django's built-in validators
        return value

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)    # hashes the password


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
```

```python
# users/views.py (part 1)
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User
from .serializers import LoginSerializer, RegisterSerializer, UserSerializer


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    authentication_classes = []            # public endpoint – ignore any stale token
```

#### 4.2.2 `POST /api/users/login/`

| | |
|---|---|
| Auth | No |
| Purpose | Verify email + password, return JWT tokens and the user |

**Request**

```json
{ "email": "ravi@example.com", "password": "StrongPass123" }
```

**Response `200 OK`** (this exact shape is what the React `AuthContext` stores)

```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "user_id": 3,
    "full_name": "Ravi Kumar",
    "email": "ravi@example.com",
    "phone": "9876543210",
    "city": "Chennai",
    "college_name": "Anna University",
    "department": "CSE",
    "role": "seller",
    "created_at": "2026-11-11T09:30:00+05:30"
  }
}
```

| Status | When |
|---|---|
| 200 | Success |
| 400 | Email/password missing or malformed |
| 401 | `{"detail": "Invalid email or password."}` (same message whether the email or password is wrong) |
| 403 | `{"detail": "Your account has been suspended. Please contact support."}` |
| 429 | More than 10 attempts per minute (throttle) |

```python
# users/views.py (part 2)
class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"               # rate defined in settings (10/min)

    def post(self, request):
        s = LoginSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        email = s.validated_data["email"].strip().lower()
        password = s.validated_data["password"]

        user = User.objects.filter(email__iexact=email).first()
        if user is None or not user.check_password(password):
            return Response({"detail": "Invalid email or password."},
                            status=status.HTTP_401_UNAUTHORIZED)
        if not user.is_active:
            return Response({"detail": "Your account has been suspended. Please contact support."},
                            status=status.HTTP_403_FORBIDDEN)

        refresh = RefreshToken.for_user(user)
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserSerializer(user).data,
        })
```

> We do the check manually (instead of Django's `authenticate()`) because `authenticate()` returns `None` for inactive users, which would hide the "suspended" message.

#### 4.2.3 `POST /api/users/token/refresh/`  (supporting)

Request `{ "refresh": "<refresh token>" }` → `200 { "access": "...", "refresh": "..." }` (a new refresh token, because rotation is on) · `401` if the refresh token is invalid/expired/blacklisted. Provided by SimpleJWT's `TokenRefreshView` (wired in `users/urls.py`).

#### 4.2.4 `POST /api/users/logout/`  (supporting)

Auth: **Yes**. Request `{ "refresh": "<refresh token>" }` → `205 Reset Content` (refresh token blacklisted). `400` if the token is missing/invalid. React also clears localStorage.

```python
# users/views.py (part 3)
class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            RefreshToken(request.data.get("refresh")).blacklist()
        except (TokenError, TypeError):
            return Response({"detail": "Invalid refresh token."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_205_RESET_CONTENT)
```

#### 4.2.5 `GET / PATCH /api/users/me/`  (supporting – SRS 3.1 "view and update profile")

Auth: **Yes**. `GET` → `200` user object. `PATCH` body may contain only `full_name`, `phone`, `city`, `college_name`, `department` (email and role cannot be changed here) → `200` updated user · `400` validation errors.

```python
# users/serializers.py (continued)
class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["full_name", "phone", "city", "college_name", "department"]

    def validate_phone(self, value):
        if value and not re.fullmatch(r"[6-9]\d{9}", value):
            raise serializers.ValidationError("Enter a valid 10-digit mobile number.")
        return value or None
```

```python
# users/views.py (part 4)
from .serializers import ProfileUpdateSerializer


class MeView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        return UserSerializer if self.request.method == "GET" else ProfileUpdateSerializer

    def partial_update(self, request, *args, **kwargs):
        s = ProfileUpdateSerializer(self.get_object(), data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(UserSerializer(self.get_object()).data)
```

#### 4.2.6 `GET /api/users/` and `PATCH /api/users/{id}/`  (admin – see Section 7)

---

### 4.3 Books

#### Shared serializer – `books/serializers.py`

```python
from django.conf import settings
from rest_framework import serializers

from core.exceptions import BadRequest
from core.permissions import is_admin

from .models import Book
from .utils import absolute_media_url, save_book_image

MAX_IMAGE_BYTES = 2 * 1024 * 1024
ALLOWED_IMAGE_TYPES = ("image/jpeg", "image/png", "image/webp")


class SellerMiniSerializer(serializers.Serializer):
    """Public seller info shown on book cards / details (no email or phone)."""
    user_id = serializers.IntegerField()
    full_name = serializers.CharField()
    city = serializers.CharField()
    college_name = serializers.CharField()


class BookSerializer(serializers.ModelSerializer):
    book_id = serializers.IntegerField(read_only=True)
    seller_id = serializers.IntegerField(read_only=True)
    seller = SellerMiniSerializer(read_only=True)
    # Upload field (React sends a file as "image"); stored path goes to image_url
    image = serializers.ImageField(write_only=True, required=False)
    image_url = serializers.CharField(required=False, allow_null=True, allow_blank=True, max_length=500)
    status = serializers.ChoiceField(choices=Book.Status.choices, required=False)

    class Meta:
        model = Book
        fields = [
            "book_id", "seller_id", "seller", "title", "author", "category", "subject",
            "department", "college_name", "city", "description", "condition", "price",
            "image", "image_url", "delivery_method", "status", "created_at",
        ]
        read_only_fields = ["created_at"]

    # ---------- field validation ----------
    def validate_title(self, v):
        v = v.strip()
        if len(v) < 3:
            raise serializers.ValidationError("Title must be at least 3 characters.")
        return v

    def validate_description(self, v):
        v = v.strip()
        if len(v) < 10:
            raise serializers.ValidationError("Add a short description (min 10 characters).")
        return v

    def validate_image(self, f):
        if f.content_type not in ALLOWED_IMAGE_TYPES:
            raise serializers.ValidationError("Only JPG, PNG or WEBP images are allowed.")
        if f.size > MAX_IMAGE_BYTES:
            raise serializers.ValidationError("Image must be smaller than 2 MB.")
        return f

    def validate_image_url(self, v):
        if v and not v.lower().startswith(("http://", "https://")):
            raise serializers.ValidationError("image_url must start with http:// or https://")
        return v or None

    def validate_status(self, value):
        """Sellers may only mark their own live listing as SOLD. Admins may set any status."""
        request = self.context["request"]
        if is_admin(request.user):
            return value
        if self.instance is None:
            return value                       # ignored on create (always starts as pending)
        if value == self.instance.status:
            return value
        if value != Book.Status.SOLD:
            raise serializers.ValidationError("Only an admin can change the status to this value.")
        if self.instance.status not in Book.PUBLIC_STATUSES:
            raise serializers.ValidationError("Only an approved listing can be marked as SOLD.")
        return value

    # ---------- output ----------
    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["image_url"] = absolute_media_url(self.context.get("request"), instance.image_url)
        return data

    # ---------- create / update ----------
    def create(self, validated_data):
        request = self.context["request"]
        image = validated_data.pop("image", None)
        if image:
            validated_data["image_url"] = save_book_image(image)
        # Listings start as 'pending'; an admin-created listing is live immediately
        validated_data["status"] = (
            Book.Status.AVAILABLE if is_admin(request.user) else Book.Status.PENDING
        )
        return super().create(validated_data)

    def update(self, instance, validated_data):
        request = self.context["request"]
        admin = is_admin(request.user)

        if instance.status == Book.Status.SOLD and not admin:
            raise BadRequest("Sold listings cannot be edited.")

        image = validated_data.pop("image", None)
        if image:
            validated_data["image_url"] = save_book_image(image)

        new_status = validated_data.get("status")
        content_changed = any(k for k in validated_data if k != "status")

        # A seller who edits a REJECTED listing is re-submitting it for review
        if not admin and instance.status == Book.Status.REJECTED and content_changed:
            validated_data["status"] = Book.Status.PENDING

        book = super().update(instance, validated_data)

        # Marking SOLD closes any still-open order requests for that book
        if new_status == Book.Status.SOLD:
            book.orders.filter(order_status__in=("requested", "accepted")).update(
                order_status="cancelled"
            )
        return book
```

> `BadRequest("...")` returns `400 {"detail": "..."}` (a plain string), which is exactly what the React `getErrorMessage()` helper reads. Plain `serializers.ValidationError("...")` inside a field validator returns `{"field": ["..."]}` instead, which the React form shows under that field.

**`books/utils.py`**

```python
import os
import uuid

from django.core.files.storage import default_storage


def save_book_image(uploaded_file) -> str:
    """Save to MEDIA_ROOT/books/ and return the relative URL, e.g. /media/books/ab12.jpg"""
    ext = os.path.splitext(uploaded_file.name)[1].lower() or ".jpg"
    name = default_storage.save(f"books/{uuid.uuid4().hex}{ext}", uploaded_file)
    return default_storage.url(name)


def absolute_media_url(request, value):
    """Turn '/media/books/x.jpg' into 'http://host/media/books/x.jpg'. External URLs pass through."""
    if not value:
        return None
    if value.startswith(("http://", "https://")) or request is None:
        return value
    return request.build_absolute_uri(value)
```

**`books/filters.py`**

```python
import django_filters as filters

from .models import Book


class BookFilter(filters.FilterSet):
    city = filters.CharFilter(lookup_expr="icontains")
    department = filters.CharFilter(lookup_expr="icontains")
    college_name = filters.CharFilter(lookup_expr="icontains")
    category = filters.CharFilter(lookup_expr="iexact")
    condition = filters.CharFilter(lookup_expr="iexact")
    min_price = filters.NumberFilter(field_name="price", lookup_expr="gte")
    max_price = filters.NumberFilter(field_name="price", lookup_expr="lte")

    class Meta:
        model = Book
        fields = ["city", "department", "college_name", "category",
                  "condition", "min_price", "max_price"]
```

(`status` and `seller` are handled in `BookViewSet.get_queryset` so that private listings can never leak through a filter.)

**`users/authentication.py`** – lets public pages work even if the browser holds a stale token.

```python
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import SAFE_METHODS
from rest_framework_simplejwt.authentication import JWTAuthentication


class SoftJWTAuthentication(JWTAuthentication):
    """
    On read-only requests an invalid/expired token is ignored (user = anonymous), so the
    public Explore page still loads. On write requests the normal 401 is raised.
    """
    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except AuthenticationFailed:
            if request.method in SAFE_METHODS:
                return None
            raise
```

**`books/views.py`** (full outline – used by endpoints 4.3.1 to 4.3.5)

```python
from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.exceptions import NotAuthenticated
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from core.exceptions import Conflict
from core.permissions import IsOwnerOrAdmin, is_admin
from users.authentication import SoftJWTAuthentication

from .filters import BookFilter
from .models import Book
from .serializers import BookSerializer

VALID_STATUSES = {c[0] for c in Book.Status.choices}


def visible_books(user):
    """Everything this user is allowed to open by id."""
    qs = Book.objects.select_related("seller")
    if is_admin(user):
        return qs
    q = Q(status__in=Book.DETAIL_STATUSES)          # approved / available / sold
    if user.is_authenticated:
        q |= Q(seller=user)                          # + my own pending / rejected
    return qs.filter(q)


class BookViewSet(viewsets.ModelViewSet):
    serializer_class = BookSerializer
    authentication_classes = [SoftJWTAuthentication]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = BookFilter
    search_fields = ["title", "author", "subject", "description"]
    ordering_fields = ["price", "created_at"]
    ordering = ["-created_at"]
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    # ---------- permissions ----------
    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        if self.action == "create":
            # For strict roles use:  [IsAuthenticated(), IsSellerOrAdmin()]
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsOwnerOrAdmin()]          # update / partial_update / destroy

    # ---------- which rows ----------
    def get_queryset(self):
        user = self.request.user
        if self.action != "list":
            return visible_books(user)

        params = self.request.query_params
        qs = Book.objects.select_related("seller")
        wanted = params.get("status")

        # 1) "My Listings" – seller sees ALL of their own listings, any status
        if params.get("seller") == "me" or params.get("mine") == "true":
            if not user.is_authenticated:
                raise NotAuthenticated()
            qs = qs.filter(seller=user)
            return qs.filter(status=wanted) if wanted in VALID_STATUSES else qs

        # 2) Admin – everything, optional ?status= filter (e.g. pending)
        if is_admin(user):
            return qs.filter(status=wanted) if wanted in VALID_STATUSES else qs

        # 3) Public Explore – approved + available only, sold/pending/rejected never shown
        #    (?status=available or ?status=approved from React is accepted; both mean "buyable")
        return qs.filter(status__in=Book.PUBLIC_STATUSES)

    # ---------- create ----------
    def perform_create(self, serializer):
        serializer.save(seller=self.request.user)

    # ---------- delete ----------
    def destroy(self, request, *args, **kwargs):
        book = self.get_object()                               # runs IsOwnerOrAdmin
        if book.orders.exists():
            raise Conflict(
                "This listing has order history and cannot be deleted. "
                "Mark it as SOLD instead."
            )
        book.delete()                                          # chats cascade
        return Response(status=status.HTTP_204_NO_CONTENT)
```

**`books/urls.py`**

```python
from rest_framework.routers import DefaultRouter

from .views import BookViewSet

router = DefaultRouter()
router.register("", BookViewSet, basename="book")
urlpatterns = router.urls          # /api/books/  and  /api/books/<pk>/
```

#### 4.3.1 `GET /api/books/`

| | |
|---|---|
| Auth | No (optional – a valid token only matters for `?seller=me` and admin views) |
| Purpose | Explore, search, filter, sort (SRS 3.3); My Listings; Admin listings |

**Query parameters**

| Param | Example | Meaning |
|---|---|---|
| `search` | `java` | title / author / subject / description contains (case-insensitive) |
| `city` | `Chennai` | city contains |
| `department` | `CSE` | department contains |
| `college_name` | `Anna` | college contains |
| `category` | `Textbook` | exact category |
| `condition` | `Good` | exact condition |
| `min_price`, `max_price` | `100`, `500` | price range (inclusive) |
| `ordering` | `price` / `-price` / `-created_at` | sort |
| `page`, `page_size` | `2`, `12` | pagination |
| `status` | `available` | Public: accepted, results are always approved+available. Admin / own listings: filters by that status (`pending`, `rejected`, `sold` …) |
| `seller=me` (or `mine=true`) | | Only the logged-in user's listings, **any** status (needs token → else `401`) |

**Example:** `GET /api/books/?search=java&city=Chennai&category=Textbook&min_price=100&max_price=500&ordering=price&page=1`

**Response `200 OK`**

```json
{
  "count": 27,
  "next": "http://127.0.0.1:8000/api/books/?page=2",
  "previous": null,
  "results": [
    {
      "book_id": 5,
      "seller_id": 3,
      "seller": { "user_id": 3, "full_name": "Ravi Kumar", "city": "Chennai", "college_name": "Anna University" },
      "title": "Data Structures using C",
      "author": "Reema Thareja",
      "category": "Textbook",
      "subject": "Data Structures",
      "department": "CSE",
      "college_name": "Anna University",
      "city": "Chennai",
      "description": "Clean copy, no markings, 2nd edition.",
      "condition": "Good",
      "price": "450.00",
      "image_url": "http://127.0.0.1:8000/media/books/ab12cd34.jpg",
      "delivery_method": "meet",
      "status": "available",
      "created_at": "2026-11-11T09:30:00+05:30"
    }
  ]
}
```

No match → `200` with `"count": 0, "results": []` (React shows "No books found"). Never `404`.

| Status | When |
|---|---|
| 200 | Always for public/admin/own lists |
| 401 | `?seller=me` without a valid token |

#### 4.3.2 `POST /api/books/`

| | |
|---|---|
| Auth | **Yes** |
| Content-Type | `multipart/form-data` (with `image` file) or `application/json` (with `image_url` text) |
| Purpose | Create a listing (SRS 3.2). Always starts as **`pending`** (admin must approve) |

**Request body (form-data fields)**

| Field | Required | Notes |
|---|---|---|
| title | ✅ | 3–200 chars |
| author | ❌ | ≤150 |
| category | ✅ | `Textbook`, `Handwritten Notes`, `Solved Question Papers`, `Lab Manual`, `Reference Book`, `Other` |
| subject | ✅ | ≤100 |
| department | ✅ | ≤100 |
| college_name | ✅ | ≤150 |
| city | ✅ | ≤100 |
| description | ✅ | ≥10 chars |
| condition | ✅ | `New`, `Like New`, `Good`, `Acceptable` |
| price | ✅ | > 0, max 2 decimals |
| image | ❌ (React makes it required) | jpg/png/webp, ≤2 MB |
| delivery_method | ❌ | `meet` (default) or `courier` |

`seller` is taken from the JWT – never from the request. Any `status` sent by a normal user is ignored.

**Response `201 Created`** – the book object (same shape as 4.3.1) with `"status": "pending"`.

| Status | When |
|---|---|
| 201 | Created |
| 400 | Field errors, e.g. `{"price": ["Ensure this value is greater than or equal to 0.01."]}` |
| 401 | No / invalid token |

#### 4.3.3 `GET /api/books/{id}/`

Auth: No (optional). Returns one book object (same shape as above).

| Status | When |
|---|---|
| 200 | Book is approved / available / **sold** (sold shows a SOLD badge in React), or you own it, or you are admin |
| 404 | Book does not exist, **or** it is pending/rejected and you are neither the owner nor an admin |

#### 4.3.4 `PUT / PATCH /api/books/{id}/`

| | |
|---|---|
| Auth | **Yes – owner or admin only** |
| PUT | Full update – all required fields must be sent |
| PATCH | Partial update – send only changed fields (React uses PATCH for edit, mark-SOLD, approve, reject) |

**Examples**

```json
// Seller edits price + condition
PATCH /api/books/5/    { "price": "400.00", "condition": "Like New" }

// Seller marks SOLD
PATCH /api/books/5/    { "status": "sold" }

// Admin approves / rejects
PATCH /api/books/5/    { "status": "approved" }
PATCH /api/books/5/    { "status": "rejected" }
```

**Response `200 OK`** – the updated book object.

| Status | When |
|---|---|
| 200 | Updated |
| 400 | Validation error; seller tries to set a status other than `sold`; "Only an approved listing can be marked as SOLD."; "Sold listings cannot be edited." |
| 401 | No / invalid token |
| 403 | `{"detail": "You can only modify your own listings."}` – book is visible but not yours |
| 404 | Book not found / hidden |

#### 4.3.5 `DELETE /api/books/{id}/`

Auth: **Yes – owner or admin only**.

| Status | When |
|---|---|
| 204 | Deleted (no body) |
| 401 | No / invalid token |
| 403 | Not the owner / admin |
| 404 | Not found |
| 409 | `{"detail": "This listing has order history and cannot be deleted. Mark it as SOLD instead."}` |

---

### 4.4 Orders

#### `orders/serializers.py`

```python
from rest_framework import serializers

from books.models import Book
from books.utils import absolute_media_url

from .models import Order


class OrderSerializer(serializers.ModelSerializer):
    order_id = serializers.IntegerField(read_only=True)
    book_id = serializers.PrimaryKeyRelatedField(source="book", queryset=Book.objects.all())
    buyer_id = serializers.IntegerField(read_only=True)
    seller_id = serializers.IntegerField(read_only=True)

    # convenience fields so React does not need extra calls
    book_title = serializers.CharField(source="book.title", read_only=True)
    book_image_url = serializers.SerializerMethodField()
    buyer_name = serializers.CharField(source="buyer.full_name", read_only=True)
    seller_name = serializers.CharField(source="seller.full_name", read_only=True)

    class Meta:
        model = Order
        fields = [
            "order_id", "book_id", "buyer_id", "seller_id",
            "book_title", "book_image_url", "buyer_name", "seller_name",
            "order_date", "agreed_price", "delivery_method", "delivery_address",
            "order_status", "updated_at",
        ]
        # agreed_price comes from the book (server side) – the client cannot set its own price
        read_only_fields = ["agreed_price", "order_status", "order_date", "updated_at"]

    def get_book_image_url(self, obj):
        return absolute_media_url(self.context.get("request"), obj.book.image_url)

    def validate(self, attrs):
        if attrs.get("delivery_method") == Order.Delivery.COURIER:
            addr = (attrs.get("delivery_address") or "").strip()
            if not addr:
                raise serializers.ValidationError(
                    {"delivery_address": "Delivery address is required for courier."}
                )
            attrs["delivery_address"] = addr
        else:
            attrs["delivery_address"] = None          # no address for in-person meet
        return attrs


class OrderStatusSerializer(serializers.Serializer):
    order_status = serializers.ChoiceField(choices=Order.Status.choices)
```

#### `orders/services.py` – status transitions

```python
from django.db import transaction
from django.utils import timezone

from books.models import Book
from core.exceptions import BadRequest

from .models import Order

# current status -> { new status: roles allowed to make this change }
TRANSITIONS = {
    "requested": {"accepted": {"seller"}, "cancelled": {"buyer", "seller"}},
    "accepted":  {"completed": {"seller"}, "cancelled": {"buyer", "seller"}},
}


@transaction.atomic
def change_order_status(order, new_status, user):
    order = Order.objects.select_for_update().get(pk=order.pk)

    if user.role != "admin":
        role = "seller" if user.pk == order.seller_id else "buyer"
        allowed = TRANSITIONS.get(order.order_status, {}).get(new_status)
        if not allowed or role not in allowed:
            raise BadRequest(
                f"You cannot change this order from '{order.order_status}' to '{new_status}'."
            )

    order.order_status = new_status
    order.save()

    if new_status == Order.Status.COMPLETED:
        # Deal done → the book is SOLD and other open requests for it are cancelled
        book = Book.objects.select_for_update().get(pk=order.book_id)
        book.status = Book.Status.SOLD
        book.save(update_fields=["status"])
        Order.objects.filter(
            book=book, order_status__in=Order.ACTIVE_STATUSES
        ).exclude(pk=order.pk).update(
            order_status=Order.Status.CANCELLED, updated_at=timezone.now()
        )
    return order
```

#### `orders/views.py`

```python
from django.db import transaction
from django.db.models import Q
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from books.models import Book
from core.exceptions import BadRequest, Conflict
from core.permissions import IsAdminRole, is_admin

from .models import Order
from .serializers import OrderSerializer, OrderStatusSerializer
from .services import change_order_status


class OrderListCreateView(generics.ListCreateAPIView):
    """POST = create order (any logged-in user).  GET = all orders (admin only)."""
    serializer_class = OrderSerializer
    pagination_class = None
    queryset = Order.objects.select_related("book", "buyer", "seller")

    def get_permissions(self):
        return [IsAdminRole()] if self.request.method == "GET" else [IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)

        with transaction.atomic():
            # Lock the book row so two buyers cannot order the last copy at the same time
            book = Book.objects.select_for_update().get(pk=s.validated_data["book"].pk)

            if book.status == Book.Status.SOLD:
                raise BadRequest("This item has been sold.")                 # SRS 3.4
            if book.status not in Book.PUBLIC_STATUSES:
                raise BadRequest("This item is not available for order.")
            if book.seller_id == request.user.pk:
                raise BadRequest("You cannot order your own listing.")
            if Order.objects.filter(
                book=book, buyer=request.user, order_status__in=Order.ACTIVE_STATUSES
            ).exists():
                raise Conflict("You already have an active order for this book.")

            order = s.save(
                book=book,
                buyer=request.user,
                seller=book.seller,
                agreed_price=book.price,
            )
        return Response(self.get_serializer(order).data, status=status.HTTP_201_CREATED)


class MyOrdersView(generics.ListAPIView):
    """Orders where I am the buyer OR the seller.  ?as=buyer or ?as=seller narrows it."""
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        u = self.request.user
        qs = Order.objects.select_related("book", "buyer", "seller")
        role = self.request.query_params.get("as")
        if role == "buyer":
            return qs.filter(buyer=u)
        if role == "seller":
            return qs.filter(seller=u)
        return qs.filter(Q(buyer=u) | Q(seller=u))


class OrderDetailView(generics.RetrieveUpdateAPIView):
    """GET one order / PATCH {"order_status": "..."}. Only buyer, seller or admin."""
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        u = self.request.user
        qs = Order.objects.select_related("book", "buyer", "seller")
        return qs if is_admin(u) else qs.filter(Q(buyer=u) | Q(seller=u))

    def get_serializer_class(self):
        return OrderStatusSerializer if self.request.method == "PATCH" else OrderSerializer

    def partial_update(self, request, *args, **kwargs):
        order = self.get_object()
        s = OrderStatusSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        order = change_order_status(order, s.validated_data["order_status"], request.user)
        return Response(OrderSerializer(order, context={"request": request}).data)
```

**`orders/urls.py`** (order matters – `my-orders/` before `<pk>/`)

```python
from django.urls import path

from .views import MyOrdersView, OrderDetailView, OrderListCreateView

urlpatterns = [
    path("", OrderListCreateView.as_view()),
    path("my-orders/", MyOrdersView.as_view()),
    path("<int:pk>/", OrderDetailView.as_view()),
]
```

#### 4.4.1 `POST /api/orders/`

| | |
|---|---|
| Auth | **Yes** |
| Purpose | Buyer sends an order / purchase request (SRS 3.4). No online payment. |

**Request**

```json
{
  "book_id": 5,
  "delivery_method": "courier",
  "delivery_address": "12, Gandhi Street, Coimbatore - 641001"
}
```

React also sends `agreed_price`; the backend **ignores it** and uses the book's current price. `delivery_address` is required only for `courier`. `buyer_id`, `seller_id`, `order_date` are set by the backend.

**Response `201 Created`**

```json
{
  "order_id": 11,
  "book_id": 5,
  "buyer_id": 8,
  "seller_id": 3,
  "book_title": "Data Structures using C",
  "book_image_url": "http://127.0.0.1:8000/media/books/ab12cd34.jpg",
  "buyer_name": "Anu Priya",
  "seller_name": "Ravi Kumar",
  "order_date": "2026-11-11T10:15:00+05:30",
  "agreed_price": "450.00",
  "delivery_method": "courier",
  "delivery_address": "12, Gandhi Street, Coimbatore - 641001",
  "order_status": "requested",
  "updated_at": "2026-11-11T10:15:00+05:30"
}
```

| Status | When |
|---|---|
| 201 | Order created, status `requested` |
| 400 | `{"detail": "This item has been sold."}` · `{"detail": "This item is not available for order."}` · `{"detail": "You cannot order your own listing."}` · `{"delivery_address": ["Delivery address is required for courier."]}` · invalid `book_id` |
| 401 | Not logged in |
| 409 | `{"detail": "You already have an active order for this book."}` |

#### 4.4.2 `GET /api/orders/my-orders/`

Auth: **Yes**. Returns a plain JSON **array** (not paginated) of orders where the user is buyer or seller, newest first. Optional `?as=buyer` / `?as=seller`.

```json
[
  {
    "order_id": 11, "book_id": 5, "buyer_id": 8, "seller_id": 3,
    "book_title": "Data Structures using C", "book_image_url": "http://127.0.0.1:8000/media/books/ab12cd34.jpg",
    "buyer_name": "Anu Priya", "seller_name": "Ravi Kumar",
    "order_date": "2026-11-11T10:15:00+05:30", "agreed_price": "450.00",
    "delivery_method": "meet", "delivery_address": null,
    "order_status": "requested", "updated_at": "2026-11-11T10:15:00+05:30"
  }
]
```

Empty → `200 []`. `401` if not logged in.

#### 4.4.3 `PATCH /api/orders/{id}/` (supporting)

Auth: **Yes** – the order's buyer, seller, or an admin. Body `{ "order_status": "accepted" }`.

| From → To | Who |
|---|---|
| requested → accepted | seller |
| requested → cancelled | buyer or seller |
| accepted → completed | seller (book becomes **SOLD**, other open requests are auto-cancelled) |
| accepted → cancelled | buyer or seller |
| any → any | admin |

Status codes: `200` updated order · `400` `{"detail": "You cannot change this order from 'completed' to 'accepted'."}` · `401` · `404` (not your order).

#### 4.4.4 `GET /api/orders/` (admin only – supporting)

Auth: **Admin**. All orders (array). `403 {"detail": "Admin access only."}` for others.

---

### 4.5 Chats

#### `chats/serializers.py`

```python
from rest_framework import serializers

from books.models import Book
from users.models import User

from .models import Chat


class ChatSerializer(serializers.ModelSerializer):
    chat_id = serializers.IntegerField(read_only=True)
    book_id = serializers.PrimaryKeyRelatedField(source="book", queryset=Book.objects.all())
    receiver_id = serializers.PrimaryKeyRelatedField(
        source="receiver", queryset=User.objects.filter(is_active=True)
    )
    sender_id = serializers.IntegerField(read_only=True)
    message = serializers.CharField(max_length=1000)

    book_title = serializers.CharField(source="book.title", read_only=True)
    sender_name = serializers.CharField(source="sender.full_name", read_only=True)
    receiver_name = serializers.CharField(source="receiver.full_name", read_only=True)

    class Meta:
        model = Chat
        fields = ["chat_id", "book_id", "sender_id", "receiver_id", "message",
                  "sent_at", "is_read", "book_title", "sender_name", "receiver_name"]
        read_only_fields = ["sent_at", "is_read"]

    def validate_message(self, v):
        v = v.strip()
        if not v:
            raise serializers.ValidationError("Message cannot be empty.")
        return v

    def validate(self, attrs):
        """Conversation rules: a chat is always between the book's seller and ONE buyer."""
        me = self.context["request"].user
        book, receiver = attrs["book"], attrs["receiver"]

        if receiver.pk == me.pk:
            raise serializers.ValidationError({"receiver_id": "You cannot message yourself."})
        if book.status not in Book.DETAIL_STATUSES and book.seller_id != me.pk:
            raise serializers.ValidationError({"book_id": "You cannot chat about this listing."})

        if me.pk != book.seller_id:
            # buyer -> seller: receiver must be the seller
            if receiver.pk != book.seller_id:
                raise serializers.ValidationError(
                    {"receiver_id": "Buyers can only message the seller of this book."}
                )
        else:
            # seller -> buyer: only if that buyer has already written to the seller about this book
            started = Chat.objects.filter(book=book, sender=receiver, receiver=me).exists()
            if not started:
                raise serializers.ValidationError(
                    {"receiver_id": "This user has not contacted you about this book."}
                )
        return attrs
```

#### `chats/views.py`

```python
from django.db.models import Q
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated

from .models import Chat
from .serializers import ChatSerializer


def _int_param(request, name):
    raw = request.query_params.get(name)
    if raw in (None, ""):
        return None
    if not raw.isdigit():
        raise ValidationError({name: "Must be a number."})
    return int(raw)


class ChatListCreateView(generics.ListCreateAPIView):
    serializer_class = ChatSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None                      # React expects a plain array

    def get_queryset(self):
        me = self.request.user
        # Only messages where I am sender or receiver -> others' chats are never visible
        qs = Chat.objects.filter(Q(sender=me) | Q(receiver=me)).select_related(
            "book", "sender", "receiver"
        )
        book_id = _int_param(self.request, "book_id")
        other = _int_param(self.request, "user")
        if book_id:
            qs = qs.filter(book_id=book_id)
        if other:
            qs = qs.filter(Q(sender_id=other) | Q(receiver_id=other))
        return qs.order_by("sent_at")

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        # Opening a specific conversation marks the incoming messages as read
        book_id = _int_param(request, "book_id")
        other = _int_param(request, "user")
        if book_id and other:
            Chat.objects.filter(
                book_id=book_id, sender_id=other, receiver=request.user, is_read=False
            ).update(is_read=True)
        return response

    def perform_create(self, serializer):
        serializer.save(sender=self.request.user)
```

**`chats/urls.py`**

```python
from django.urls import path

from .views import ChatListCreateView

urlpatterns = [path("", ChatListCreateView.as_view())]
```

#### 4.5.1 `GET /api/chats/`

Auth: **Yes**. Returns a plain **array**, oldest → newest, of messages where the user is sender or receiver (so only participants ever see a conversation – SRS 3.5).

| Query | Meaning |
|---|---|
| *(none)* | All my messages – React groups them by (`book_id`, other user) to build the conversation list |
| `book_id=5` | Messages about book 5 |
| `book_id=5&user=8` | One conversation (book 5 with user 8). Also marks messages sent *to me* as read |

```json
[
  {
    "chat_id": 21, "book_id": 5, "sender_id": 8, "receiver_id": 3,
    "message": "Is this still available?",
    "sent_at": "2026-11-11T10:20:00+05:30", "is_read": true,
    "book_title": "Data Structures using C", "sender_name": "Anu Priya", "receiver_name": "Ravi Kumar"
  },
  {
    "chat_id": 22, "book_id": 5, "sender_id": 3, "receiver_id": 8,
    "message": "Yes! I can meet near the library tomorrow.",
    "sent_at": "2026-11-11T10:22:00+05:30", "is_read": false,
    "book_title": "Data Structures using C", "sender_name": "Ravi Kumar", "receiver_name": "Anu Priya"
  }
]
```

A conversation that is not yours simply returns `[]` (it is filtered out, not an error).

| Status | When |
|---|---|
| 200 | Array (possibly empty) |
| 400 | `book_id` / `user` is not a number |
| 401 | Not logged in |

#### 4.5.2 `POST /api/chats/`

Auth: **Yes**. `sender_id` comes from the JWT.

**Request**

```json
{ "book_id": 5, "receiver_id": 3, "message": "Is this still available?" }
```

**Response `201 Created`** – the chat object (shape above, `is_read: false`).

| Status | When |
|---|---|
| 201 | Message saved |
| 400 | Empty / >1000-char message · "You cannot message yourself." · "Buyers can only message the seller of this book." · "This user has not contacted you about this book." |
| 401 | Not logged in |

---

## 5. CRUD Operations Flow & Business Rules

### 5.1 CRUD for Books (SRS 7.3)

| Operation | HTTP | Endpoint | Who | DB effect |
|---|---|---|---|---|
| **Create** | POST | `/api/books/` | Any logged-in user | New row in `books`, `status = pending`, `seller_id` = current user |
| **Read** (list) | GET | `/api/books/` | Anyone | Only `approved` / `available` rows (sold, pending, rejected hidden) |
| **Read** (detail) | GET | `/api/books/{id}/` | Anyone | approved / available / sold; own pending & rejected for the owner; everything for admin |
| **Read** (mine) | GET | `/api/books/?seller=me` | Owner | All the owner's rows, any status |
| **Update** | PUT / PATCH | `/api/books/{id}/` | **Owner or admin only** | Row updated |
| **Delete** | DELETE | `/api/books/{id}/` | **Owner or admin only** | Row removed – **unless it has orders** (409) |

### 5.2 Permission matrix

| Action | Anonymous | Buyer/Seller (not owner) | Owner | Admin |
|---|---|---|---|---|
| List approved/available books | ✅ | ✅ | ✅ | ✅ |
| View sold book details | ✅ | ✅ | ✅ | ✅ |
| View pending/rejected book | ❌ 404 | ❌ 404 | ✅ | ✅ |
| Create listing | ❌ 401 | ✅ | – | ✅ |
| Update listing | ❌ 401 | ❌ **403** | ✅ | ✅ |
| Delete listing | ❌ 401 | ❌ **403** | ✅ (no orders) | ✅ (no orders) |
| Mark own listing SOLD | ❌ | ❌ 403 | ✅ | ✅ |
| Set status approved/rejected/available/pending | ❌ | ❌ | ❌ 400 | ✅ |
| Create order | ❌ 401 | ✅ (not own book) | ❌ 400 (own book) | ✅ |
| Read/send chat | ❌ 401 | ✅ (own conversations only) | ✅ | ✅ |

### 5.3 Book status lifecycle

```
              seller creates
                   │
                   ▼
              ┌─────────┐   admin: approve    ┌──────────┐
              │ pending │ ──────────────────► │ approved │ ─┐   (approved ≡ available:
              └────┬────┘                     └──────────┘  │    both are visible & buyable)
                   │ admin: reject                           │
                   ▼                           ┌───────────┐│  seller: mark SOLD
              ┌──────────┐                     │ available │├────────────────────┐
              │ rejected │                     └───────────┘│  or order completed │
              └────┬─────┘                                  ▼                    │
                   │ seller edits → back to `pending`   ┌────────┐ ◄─────────────┘
                   └───────────────────────────────────►│  sold  │  (cannot be ordered again,
                                                        └────────┘   hidden from Explore)
```

`approved` and `available` are treated the same everywhere (`Book.PUBLIC_STATUSES`). Pick either as your "live" state; the React admin tab sends `approved`.

### 5.4 Rules and where they are enforced

| Rule | Where |
|---|---|
| Only the **owner** (or admin) can update / delete a listing | `IsOwnerOrAdmin` object permission → `403` |
| `seller` can never be set from the request | `perform_create` uses `request.user`; `seller_id` is read-only |
| Normal users cannot approve/reject/reactivate | `BookSerializer.validate_status` → `400` |
| **Sold books cannot be ordered again** | `OrderListCreateView.create` → `400 "This item has been sold."` under a row lock (`select_for_update`) so two simultaneous buyers cannot both succeed |
| A user cannot order their own book | same view → `400` |
| Duplicate active order by the same buyer | same view → `409` |
| Pending / rejected books cannot be ordered | same view → `400` |
| Sold listings cannot be edited by the seller | `BookSerializer.update` → `400` |
| Marking SOLD cancels still-open order requests | `BookSerializer.update` |
| Completing an order marks the book SOLD and cancels other open requests | `orders.services.change_order_status` |
| Listing with orders cannot be deleted (history is kept, SRS 3.6) | `BookViewSet.destroy` → `409`; `PROTECT` foreign keys as a safety net |
| Rejected listing edited by seller → re-submitted as `pending` | `BookSerializer.update` |
| Sold books excluded from default search | `get_queryset` public branch |
| Only chat participants can read messages | `ChatListCreateView.get_queryset` filter |
| Chats only between seller and one buyer; no self-chat | `ChatSerializer.validate` + DB check constraint |
| Order price is the book's price, not the client's | `create()` sets `agreed_price=book.price` |
| Delivery address only stored for courier, only visible to buyer/seller/admin | `OrderSerializer.validate`; order querysets filtered by participant |

---

## 6. Authentication & Permissions

### 6.1 Django Auth + JWT

SRS: *"Django Authentication and/or JWT."* We use **both**: Django's user model and password hashing, plus **SimpleJWT** tokens for the React client (stateless – no cookies/sessions for the API).

```
 Register ─► user row created (password hashed)
 Login ────► check email + password ─► return { access, refresh, user }
 Every protected call:  Authorization: Bearer <access>
                         └─► JWTAuthentication decodes it ─► request.user
                         └─► permission classes decide allow / deny
 Access expires ─► 401 ─► (refresh via /api/users/token/refresh/) or login again
 Logout ───► refresh token blacklisted
```

| Token | Lifetime (see settings) | Purpose |
|---|---|---|
| `access` | 1 day | Sent on every request |
| `refresh` | 7 days | Get a new access token; blacklisted on logout |

> The React app in `FRONTEND.md` has no auto-refresh interceptor – on `401` it logs the user out. That is why `access` lives for 1 day. If you later add silent refresh on the frontend, shorten it to 15–60 minutes.

### 6.2 Password hashing

- Passwords are hashed by `set_password()` (called inside `create_user`) using Django's default **PBKDF2-SHA256** with salt. Plain text is never stored or logged; `password` is `write_only` in serializers and never appears in any response.
- The `password` column is `VARCHAR(255)` (SRS) – enough for PBKDF2 (≈ 88 chars) and for Argon2.
- Optional stronger hasher: `pip install argon2-cffi` and put `"django.contrib.auth.hashers.Argon2PasswordHasher"` first in `PASSWORD_HASHERS`.
- Password strength is checked by Django's `AUTH_PASSWORD_VALIDATORS` (min length, not too common, not all numeric, not similar to user data).

### 6.3 Who can do what (authenticated-only operations)

| Operation | Enforcement |
|---|---|
| Create a listing | `IsAuthenticated` on `create` |
| Create an order | `IsAuthenticated` on `OrderListCreateView.POST` |
| Read / send chat | `IsAuthenticated` + participant filter |
| Update / delete a listing | `IsAuthenticated` + `IsOwnerOrAdmin` |
| Admin endpoints | `IsAdminRole` |
| Browse / search / view book | `AllowAny` (read-only) |

DRF default (`REST_FRAMEWORK["DEFAULT_PERMISSION_CLASSES"]`) is `IsAuthenticated`, so any new endpoint is **private unless you deliberately open it**.

### 6.4 Suspended users

`is_active = False` means suspended. Effects:

- **Login** → `403 "Your account has been suspended…"`.
- **Existing token** → SimpleJWT rejects it with `401` ("User is inactive") on the next request, so the user is logged out immediately.
- They cannot receive new chat messages (`receiver_id` queryset only includes active users).
- Their books remain in the database; admin can reject/remove them separately.

### 6.5 Optional: strict seller-only creation

If your guide requires that only `seller` / `admin` can post listings, add this and use it in `BookViewSet.get_permissions` for `create`:

```python
# core/permissions.py
class IsSellerOrAdmin(BasePermission):
    message = "Only sellers can create listings."
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.role in ("seller", "admin"))
```

(Then change the React registration/Sell page to match; the default build lets every logged-in student sell.)

### 6.6 Security checklist

- `SECRET_KEY`, DB password in `.env`, never in Git.
- `DEBUG=False`, real `ALLOWED_HOSTS`, HTTPS, secure cookies in production (Section 8).
- Login throttling (`10/min`) against brute-force.
- Image uploads: type + size validated, saved under random UUID names (no user-supplied file names).
- Responses never include `password`, other users' emails or phones (book `seller` object exposes only name, city, college).
- Delivery addresses visible only to the two order participants and admins.
- CORS limited to the React origin(s).

---

## 7. Admin Features

SRS 3.7 admin requirements, and how they are delivered:

| SRS requirement | Via React Admin Dashboard (API) | Via Django admin site (`/admin/`) |
|---|---|---|
| Secure admin login | Normal login; `role = admin`; React `AdminRoute` | Staff login (`is_staff` is auto-set for admins) |
| View / approve / reject listings | `GET /api/books/?status=pending` · `PATCH /api/books/{id}/ {"status": "approved"\|"rejected"}` | Book list → bulk actions "Approve" / "Reject" |
| Edit / deactivate / remove inappropriate listings | `PATCH` (e.g. status `rejected`) · `DELETE /api/books/{id}/` | Edit form, delete |
| View & manage users, **suspend accounts** | `GET /api/users/` · `PATCH /api/users/{id}/ {"is_active": false}` | User list → "Suspend" / "Activate" actions |
| View book and order records | `GET /api/books/` · `GET /api/orders/` | Book & Order lists with filters |
| Review user reports | *Not in the SRS tables – future enhancement (add a `Reports` model)* | – |

### 7.1 Create the first admin

```bash
python manage.py createsuperuser
# Email: admin@bookloop.in
# Full name / City / College name / Department: (any values)
# Password: ********
```

`create_superuser` sets `role="admin"`, `is_staff=True`, `is_superuser=True`. Log in at `/api/users/login/` from React (admin lands on `/admin`) or at `http://127.0.0.1:8000/admin/`.

### 7.2 Admin user-management API

```python
# users/serializers.py (continued)
class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["user_id", "full_name", "email", "phone", "city", "college_name",
                  "department", "role", "is_active", "created_at"]
        read_only_fields = ["user_id", "full_name", "email", "phone", "city",
                            "college_name", "department", "created_at"]
        # editable by admin: is_active (suspend / activate) and role
```

```python
# users/views.py (part 5)
from rest_framework.filters import SearchFilter
from core.exceptions import BadRequest
from core.permissions import IsAdminRole
from .serializers import AdminUserSerializer


class AdminUserListView(generics.ListAPIView):
    """GET /api/users/?search=ravi&role=seller&is_active=false"""
    queryset = User.objects.all()
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdminRole]
    filter_backends = [SearchFilter]
    search_fields = ["full_name", "email", "city", "college_name"]
    pagination_class = None                       # small tables; React handles array or {results}

    def get_queryset(self):
        qs = super().get_queryset()
        role = self.request.query_params.get("role")
        active = self.request.query_params.get("is_active")
        if role:
            qs = qs.filter(role=role)
        if active in ("true", "false"):
            qs = qs.filter(is_active=(active == "true"))
        return qs


class AdminUserDetailView(generics.RetrieveUpdateAPIView):
    queryset = User.objects.all()
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdminRole]
    http_method_names = ["get", "patch", "head", "options"]

    def partial_update(self, request, *args, **kwargs):
        target = self.get_object()
        if target.pk == request.user.pk:
            raise BadRequest("You cannot suspend or change your own account.")
        return super().partial_update(request, *args, **kwargs)
```

**`GET /api/users/`** → `200` array of users (fields: `user_id, full_name, email, phone, city, college_name, department, role, is_active, created_at`) · `401` · `403 {"detail": "Admin access only."}`.

**`PATCH /api/users/{id}/`** body `{ "is_active": false }` (suspend) or `{ "is_active": true }` (reactivate) → `200` user · `400 "You cannot suspend or change your own account."` · `403` · `404`.

### 7.3 `users/urls.py`

```python
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (AdminUserDetailView, AdminUserListView, LoginView, LogoutView,
                    MeView, RegisterView)

urlpatterns = [
    path("register/", RegisterView.as_view()),
    path("login/", LoginView.as_view()),
    path("logout/", LogoutView.as_view()),
    path("token/refresh/", TokenRefreshView.as_view()),
    path("me/", MeView.as_view()),
    path("", AdminUserListView.as_view()),                 # admin
    path("<int:pk>/", AdminUserDetailView.as_view()),      # admin
]
```

### 7.4 Django admin site registration

```python
# users/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ("-created_at",)
    list_display = ("user_id", "full_name", "email", "role", "city", "college_name", "is_active")
    list_filter = ("role", "is_active", "city")
    search_fields = ("full_name", "email", "college_name")
    readonly_fields = ("created_at", "last_login")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Profile", {"fields": ("full_name", "phone", "city", "college_name", "department", "role")}),
        ("Status", {"fields": ("is_active", "is_staff", "is_superuser")}),
        ("Dates", {"fields": ("created_at", "last_login")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": (
            "email", "full_name", "city", "college_name", "department", "role",
            "password1", "password2")}),
    )
    actions = ["suspend_users", "activate_users"]

    @admin.action(description="Suspend selected users")
    def suspend_users(self, request, queryset):
        queryset.exclude(pk=request.user.pk).update(is_active=False)

    @admin.action(description="Activate selected users")
    def activate_users(self, request, queryset):
        queryset.update(is_active=True)
```

> `BaseUserAdmin`'s add form expects `username`-style fields. If the "Add user" page errors, create users with `createsuperuser` / the register API instead, or write a small `UserCreationForm` subclass – this does not affect the API.

```python
# books/admin.py
from django.contrib import admin

from .models import Book


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ("book_id", "title", "seller", "category", "city", "college_name",
                    "price", "status", "created_at")
    list_filter = ("status", "category", "city", "department")
    search_fields = ("title", "author", "subject", "seller__email", "college_name")
    actions = ["approve", "reject"]

    @admin.action(description="Approve selected listings")
    def approve(self, request, queryset):
        queryset.filter(status=Book.Status.PENDING).update(status=Book.Status.APPROVED)

    @admin.action(description="Reject selected listings")
    def reject(self, request, queryset):
        queryset.filter(status=Book.Status.PENDING).update(status=Book.Status.REJECTED)
```

```python
# orders/admin.py
from django.contrib import admin
from .models import Order


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("order_id", "book", "buyer", "seller", "agreed_price",
                    "delivery_method", "order_status", "order_date")
    list_filter = ("order_status", "delivery_method")
    search_fields = ("book__title", "buyer__email", "seller__email")
```

```python
# chats/admin.py
from django.contrib import admin
from .models import Chat


@admin.register(Chat)
class ChatAdmin(admin.ModelAdmin):
    list_display = ("chat_id", "book", "sender", "receiver", "sent_at", "is_read")
    list_filter = ("is_read",)
    search_fields = ("message", "sender__email", "receiver__email")
```

---

## 8. Settings (MySQL, CORS, MEDIA, JWT)

### 8.1 Create the MySQL database (MySQL Workbench or terminal)

```sql
CREATE DATABASE bookloop_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'bookloop_user'@'localhost' IDENTIFIED BY 'ChangeThisPassword!';
GRANT ALL PRIVILEGES ON bookloop_db.* TO 'bookloop_user'@'localhost';
FLUSH PRIVILEGES;
```

`utf8mb4` supports every character (₹, Tamil/Hindi text, emojis in chat).

### 8.2 `.env` (and commit only `.env.example`)

```env
SECRET_KEY=change-me-to-a-long-random-string
DEBUG=True
ALLOWED_HOSTS=127.0.0.1,localhost

DB_NAME=bookloop_db
DB_USER=bookloop_user
DB_PASSWORD=ChangeThisPassword!
DB_HOST=127.0.0.1
DB_PORT=3306

CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Generate a secret key: `python -c "from django.core.management.utils import get_random_secret_key as g; print(g())"`

### 8.3 `bookloop_backend/settings.py`

```python
from datetime import timedelta
from pathlib import Path

from decouple import Csv, config

BASE_DIR = Path(__file__).resolve().parent.parent

# ------------------------------------------------------------------ core
SECRET_KEY = config("SECRET_KEY")
DEBUG = config("DEBUG", default=False, cast=bool)
ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="127.0.0.1,localhost", cast=Csv())

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # third party
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",     # logout / refresh rotation
    "corsheaders",
    "django_filters",
    # BookLoop apps
    "core",
    "users",
    "books",
    "orders",
    "chats",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",         # MUST be above CommonMiddleware
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "bookloop_backend.urls"
WSGI_APPLICATION = "bookloop_backend.wsgi.application"

TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [],
    "APP_DIRS": True,
    "OPTIONS": {"context_processors": [
        "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
    ]},
}]

# ------------------------------------------------------------------ MySQL
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": config("DB_NAME"),
        "USER": config("DB_USER"),
        "PASSWORD": config("DB_PASSWORD"),
        "HOST": config("DB_HOST", default="127.0.0.1"),
        "PORT": config("DB_PORT", default="3306"),
        "OPTIONS": {
            "charset": "utf8mb4",
            "init_command": "SET sql_mode='STRICT_TRANS_TABLES'",
        },
    }
}

# ------------------------------------------------------------------ auth
AUTH_USER_MODEL = "users.User"            # set BEFORE the first migrate!

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ------------------------------------------------------------------ DRF
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_PAGINATION_CLASS": "core.pagination.StandardPagination",
    "PAGE_SIZE": 12,
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_RENDERER_CLASSES": ("rest_framework.renderers.JSONRenderer",)
        if not DEBUG else (
            "rest_framework.renderers.JSONRenderer",
            "rest_framework.renderers.BrowsableAPIRenderer",
        ),
    "DEFAULT_THROTTLE_RATES": {"login": "10/min"},
}

# ------------------------------------------------------------------ JWT
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(days=1),     # React has no silent refresh (see 6.1)
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "user_id",       # our primary key is user_id, NOT id  (required!)
    "USER_ID_CLAIM": "user_id",
}

# ------------------------------------------------------------------ CORS (React dev server)
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:3000,http://127.0.0.1:3000",
    cast=Csv(),
)
CORS_ALLOW_CREDENTIALS = False        # JWT in header, no cookies needed

# ------------------------------------------------------------------ static & MEDIA (book images)
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DATA_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024     # 5 MB request body limit
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024

# ------------------------------------------------------------------ i18n
LANGUAGE_CODE = "en-in"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.AutoField"

# ------------------------------------------------------------------ production hardening
if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
```

> Because we use explicit primary keys named `user_id`, `book_id` etc., `DEFAULT_AUTO_FIELD` only matters for Django's own tables.

### 8.4 `bookloop_backend/urls.py`

```python
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/users/", include("users.urls")),
    path("api/books/", include("books.urls")),
    path("api/orders/", include("orders.urls")),
    path("api/chats/", include("chats.urls")),
]

# Serve uploaded images in development. In production, let Nginx/S3 serve /media/.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

### 8.5 Run it

```bash
python manage.py makemigrations users books orders chats
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver            # http://127.0.0.1:8000
```

---

## 9. Testing

### 9.1 Postman setup

1. **Create an Environment** "BookLoop Local" with variables:

   | Variable | Initial value |
   |---|---|
   | `base_url` | `http://127.0.0.1:8000` |
   | `access` | *(empty)* |
   | `refresh` | *(empty)* |
   | `book_id` | *(empty)* |
   | `order_id` | *(empty)* |

2. **Create a Collection** "BookLoop API" → *Authorization* tab → Type **Bearer Token** → Token `{{access}}`. Every request inherits it automatically.
3. On the **Login** request, open the **Tests** tab and paste this so the token is saved after login:

   ```javascript
   const res = pm.response.json();
   if (res.access) {
     pm.environment.set("access", res.access);
     pm.environment.set("refresh", res.refresh);
   }
   ```

4. On **Create Book**, Tests tab: `pm.environment.set("book_id", pm.response.json().book_id);`
   On **Create Order**, Tests tab: `pm.environment.set("order_id", pm.response.json().order_id);`
5. For public requests (register, login, list books) set Authorization → **No Auth** on that request.
6. Use at least **three accounts**: a seller, a buyer, an admin (`createsuperuser`). To switch, log in again – the Tests script overwrites `{{access}}`.

### 9.2 Sample requests (run in this order)

| # | Request | Method + URL | Body | Expect |
|---|---|---|---|---|
| 1 | Register seller | POST `{{base_url}}/api/users/register/` | JSON ↓ | **201** |
| 2 | Register buyer | POST same | other email, `"role":"buyer"` | **201** |
| 3 | Register duplicate | POST same | same email as #1 | **400** `email` error |
| 4 | Login seller | POST `{{base_url}}/api/users/login/` | `{"email":"ravi@example.com","password":"StrongPass123"}` | **200** + tokens |
| 5 | Wrong password | POST login | wrong password | **401** |
| 6 | Create book (no token) | POST `{{base_url}}/api/books/` | – | **401** |
| 7 | Create book (seller) | POST `{{base_url}}/api/books/` | **form-data** ↓ | **201**, `status: pending` |
| 8 | List books (public) | GET `{{base_url}}/api/books/` | – | **200**, new book **not** listed (pending) |
| 9 | My listings | GET `{{base_url}}/api/books/?seller=me` | – | **200**, shows the pending book |
| 10 | Login admin, approve | PATCH `{{base_url}}/api/books/{{book_id}}/` | `{"status":"approved"}` | **200** |
| 11 | List books again | GET `/api/books/?search=data&city=Chennai&ordering=price` | – | **200**, book now listed |
| 12 | Book details | GET `/api/books/{{book_id}}/` | – | **200** |
| 13 | Login buyer, edit seller's book | PATCH `/api/books/{{book_id}}/` | `{"price":"1"}` | **403** |
| 14 | Order own book (seller token) | POST `/api/orders/` | `{"book_id":{{book_id}},"delivery_method":"meet"}` | **400** |
| 15 | Create order (buyer) | POST `/api/orders/` | `{"book_id":{{book_id}},"delivery_method":"meet"}` | **201** |
| 16 | Duplicate order (buyer) | POST `/api/orders/` | same | **409** |
| 17 | My orders (buyer) | GET `/api/orders/my-orders/` | – | **200** array |
| 18 | Chat: buyer → seller | POST `/api/chats/` | `{"book_id":{{book_id}},"receiver_id":<seller user_id>,"message":"Is this available?"}` | **201** |
| 19 | Chat: seller → buyer | POST `/api/chats/` (seller token) | `{"book_id":…,"receiver_id":<buyer user_id>,"message":"Yes!"}` | **201** |
| 20 | Read conversation | GET `/api/chats/?book_id={{book_id}}&user=<other id>` | – | **200** array |
| 21 | Third user reads it | GET same URL with another user's token | – | **200 `[]`** |
| 22 | Seller accepts, completes | PATCH `/api/orders/{{order_id}}/` | `{"order_status":"accepted"}` then `{"order_status":"completed"}` | **200** each |
| 23 | Order the sold book (3rd user) | POST `/api/orders/` | book_id | **400** "This item has been sold." |
| 24 | Delete book with orders (seller) | DELETE `/api/books/{{book_id}}/` | – | **409** |
| 25 | Admin lists users | GET `/api/users/` | – | **200** (non-admin → **403**) |
| 26 | Admin suspends buyer | PATCH `/api/users/<id>/` | `{"is_active":false}` | **200**; then buyer login → **403** |
| 27 | Admin all orders | GET `/api/orders/` | – | **200** (non-admin → **403**) |

**Request #1 body (raw → JSON)**

```json
{
  "full_name": "Ravi Kumar",
  "email": "ravi@example.com",
  "password": "StrongPass123",
  "phone": "9876543210",
  "city": "Chennai",
  "college_name": "Anna University",
  "department": "CSE",
  "role": "seller"
}
```

**Request #7 body (Body → form-data)** – change the `image` row's type from *Text* to *File*:

| Key | Type | Value |
|---|---|---|
| title | Text | Data Structures using C |
| author | Text | Reema Thareja |
| category | Text | Textbook |
| subject | Text | Data Structures |
| department | Text | CSE |
| college_name | Text | Anna University |
| city | Text | Chennai |
| description | Text | Clean copy, no markings, 2nd edition. |
| condition | Text | Good |
| price | Text | 450.00 |
| delivery_method | Text | meet |
| image | **File** | *(choose a .jpg under 2 MB)* |

### 9.3 cURL equivalents

```bash
# Login and capture the token
curl -s -X POST http://127.0.0.1:8000/api/users/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"ravi@example.com","password":"StrongPass123"}'

# Create a book with an image
curl -X POST http://127.0.0.1:8000/api/books/ \
  -H "Authorization: Bearer $ACCESS" \
  -F title="Data Structures using C" -F author="Reema Thareja" -F category="Textbook" \
  -F subject="Data Structures" -F department="CSE" -F college_name="Anna University" \
  -F city="Chennai" -F description="Clean copy, no markings." -F condition="Good" \
  -F price=450.00 -F delivery_method=meet -F image=@./book.jpg

# Public search
curl "http://127.0.0.1:8000/api/books/?search=java&city=Chennai&ordering=price"

# Place an order
curl -X POST http://127.0.0.1:8000/api/orders/ \
  -H "Authorization: Bearer $ACCESS" -H "Content-Type: application/json" \
  -d '{"book_id":5,"delivery_method":"meet"}'
```

### 9.4 Automated tests (Django `APITestCase`)

Run with `python manage.py test`. Create `books/tests.py` (and the same style for orders / chats). Django creates a temporary test database, so your real data is untouched.

```python
from rest_framework.test import APITestCase

from books.models import Book
from users.models import User


def make_user(email, role="buyer", **extra):
    return User.objects.create_user(
        email=email, password="StrongPass123", full_name=email.split("@")[0],
        city="Chennai", college_name="Anna University", department="CSE", role=role, **extra,
    )


def login(client, email):
    r = client.post("/api/users/login/", {"email": email, "password": "StrongPass123"}, format="json")
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
    return r


class BookLoopRulesTests(APITestCase):
    def setUp(self):
        self.seller = make_user("seller@x.com", "seller")
        self.buyer = make_user("buyer@x.com", "buyer")
        self.admin = make_user("admin@x.com", "admin")
        self.book = Book.objects.create(
            seller=self.seller, title="Java Notes", category="Handwritten Notes",
            subject="Java", department="CSE", college_name="Anna University", city="Chennai",
            description="Neat handwritten notes.", condition="Good", price="100.00",
            status="available",
        )

    def test_register_hashes_password(self):
        r = self.client.post("/api/users/register/", {
            "full_name": "New User", "email": "new@x.com", "password": "StrongPass123",
            "city": "Delhi", "college_name": "DU", "department": "ECE", "role": "buyer",
        }, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertNotIn("password", r.data)
        self.assertNotEqual(User.objects.get(email="new@x.com").password, "StrongPass123")

    def test_login_returns_tokens_and_suspended_is_blocked(self):
        r = login(self.client, "buyer@x.com")
        self.assertIn("refresh", r.data)
        self.buyer.is_active = False
        self.buyer.save()
        self.client.credentials()
        r = self.client.post("/api/users/login/", {"email": "buyer@x.com", "password": "StrongPass123"}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_anonymous_cannot_create_listing(self):
        self.assertEqual(self.client.post("/api/books/", {}, format="json").status_code, 401)

    def test_only_owner_can_update_or_delete(self):
        login(self.client, "buyer@x.com")
        url = f"/api/books/{self.book.pk}/"
        self.assertEqual(self.client.patch(url, {"price": "1.00"}, format="json").status_code, 403)
        self.assertEqual(self.client.delete(url).status_code, 403)
        login(self.client, "seller@x.com")
        self.assertEqual(self.client.patch(url, {"price": "90.00"}, format="json").status_code, 200)

    def test_seller_cannot_self_approve(self):
        login(self.client, "seller@x.com")
        r = self.client.patch(f"/api/books/{self.book.pk}/", {"status": "approved"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_sold_book_cannot_be_ordered(self):
        login(self.client, "seller@x.com")
        self.client.patch(f"/api/books/{self.book.pk}/", {"status": "sold"}, format="json")
        login(self.client, "buyer@x.com")
        r = self.client.post("/api/orders/", {"book_id": self.book.pk, "delivery_method": "meet"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("sold", r.data["detail"].lower())

    def test_cannot_order_own_book_and_no_duplicate_order(self):
        login(self.client, "seller@x.com")
        r = self.client.post("/api/orders/", {"book_id": self.book.pk, "delivery_method": "meet"}, format="json")
        self.assertEqual(r.status_code, 400)
        login(self.client, "buyer@x.com")
        ok = self.client.post("/api/orders/", {"book_id": self.book.pk, "delivery_method": "meet"}, format="json")
        self.assertEqual(ok.status_code, 201)
        dup = self.client.post("/api/orders/", {"book_id": self.book.pk, "delivery_method": "meet"}, format="json")
        self.assertEqual(dup.status_code, 409)

    def test_public_list_hides_pending_and_sold(self):
        Book.objects.create(seller=self.seller, title="Pending One", category="Textbook", subject="X",
                            department="CSE", college_name="A", city="C", description="1234567890",
                            condition="Good", price="10", status="pending")
        r = self.client.get("/api/books/")
        titles = [b["title"] for b in r.data["results"]]
        self.assertIn("Java Notes", titles)
        self.assertNotIn("Pending One", titles)

    def test_chat_only_visible_to_participants(self):
        login(self.client, "buyer@x.com")
        r = self.client.post("/api/chats/", {"book_id": self.book.pk, "receiver_id": self.seller.pk,
                                             "message": "Available?"}, format="json")
        self.assertEqual(r.status_code, 201)
        stranger = make_user("stranger@x.com")
        login(self.client, "stranger@x.com")
        r = self.client.get(f"/api/chats/?book_id={self.book.pk}&user={self.seller.pk}")
        self.assertEqual(r.data, [])

    def test_non_admin_cannot_list_users(self):
        login(self.client, "buyer@x.com")
        self.assertEqual(self.client.get("/api/users/").status_code, 403)
        login(self.client, "admin@x.com")
        self.assertEqual(self.client.get("/api/users/").status_code, 200)
```

### 9.5 Common problems

| Problem | Fix |
|---|---|
| `CORS` error in the browser | Add the React origin to `CORS_ALLOWED_ORIGINS`; `corsheaders` middleware must be above `CommonMiddleware`; restart the server |
| `401` on every protected call | Header must be exactly `Authorization: Bearer <access>` (with the word Bearer and one space) |
| `KeyError: 'id'` / token errors | `SIMPLE_JWT["USER_ID_FIELD"]` must be `"user_id"` |
| `no such table: auth_user` / `swappable` error | `AUTH_USER_MODEL` was set after the first migrate. Drop the DB, recreate it, migrate again |
| Image upload `400` | In Postman, the `image` row must be type **File**; body type **form-data** (not raw JSON) |
| `You have a mysqlclient problem` | Install the PyMySQL fallback from 2.3 |
| Sold book still visible in Explore | Check `status` really is `sold`; public list only returns `approved` / `available` |
| Images 404 in the browser | `DEBUG=True` and the `static(MEDIA_URL…)` line is in `urls.py`; check files exist in `media/books/` |

---

## 10. Step-by-Step Build Order

| Step | Task | Done when |
|---|---|---|
| **1** | Install Python, MySQL, create venv, `pip install -r requirements.txt` | `python -c "import django, rest_framework"` works |
| **2** | `django-admin startproject bookloop_backend .` and the five `startapp` commands | Folders from Section 2.4 exist |
| **3** | Create the MySQL database + user (8.1), `.env` (8.2) | You can log in to MySQL with `bookloop_user` |
| **4** | Write `settings.py` (8.3) – **with `AUTH_USER_MODEL`** – and `core/` helpers (2.5) | `python manage.py check` shows no errors |
| **5** | Write `users/models.py` (3.3), then `books`, `orders`, `chats` models (3.4–3.6) | Models import without errors |
| **6** | `makemigrations users books orders chats` → `migrate` | Tables `users`, `books`, `orders`, `chats` appear in MySQL Workbench |
| **7** | `createsuperuser`, open `/admin/`, register models (7.4) | You can log in to Django admin and see all 4 tables |
| **8** | Users API: serializers + views + `users/urls.py` + `SoftJWTAuthentication` (4.2, 7.3) | Postman #1–#5 pass |
| **9** | Books API: utils, filters, serializer, `BookViewSet`, `books/urls.py`, root `urls.py` (4.3, 8.4) | Postman #6–#13 pass |
| **10** | Orders API: serializer, services, views, urls (4.4) | Postman #14–#17, #22–#24 pass |
| **11** | Chats API: serializer, view, urls (4.5) | Postman #18–#21 pass |
| **12** | Admin API: `AdminUserListView` / `AdminUserDetailView` (7.2) | Postman #25–#27 pass |
| **13** | Write automated tests (9.4) and run `python manage.py test` | All green |
| **14** | Connect the React app: set `REACT_APP_API_URL`, test register → login → explore → sell → order → chat | The full flow works from the browser |
| **15** | Production prep: `DEBUG=False`, real `SECRET_KEY`, HTTPS, Nginx/S3 for `/media/` (optional for the college demo) | – |

---

## 11. Frontend Contract (what React expects)

`FRONTEND.md` Section 10 lists 17 assumptions. This is how the backend above satisfies each one – nothing to negotiate, just build as written.

| # | Frontend assumption | Backend answer |
|---|---|---|
| 1 | Login returns `{ access, refresh, user:{…} }` | ✅ 4.2.2 |
| 2 | `Authorization: Bearer <access>` | ✅ SimpleJWT, `AUTH_HEADER_TYPES = ("Bearer",)` |
| 3 | Book id is `book_id` (React also tolerates `id`) | ✅ `book_id`; users `user_id`; orders `order_id`; chats `chat_id` |
| 4 | Query params `search, city, department, college_name, category, condition, min_price, max_price, ordering, page, status` | ✅ 4.3.1 |
| 5 | Pagination `{ count, results }`, 12 per page | ✅ `StandardPagination` (books). Orders, chats and admin users return plain arrays (React handles both) |
| 6 | Statuses `pending, approved, rejected, available, sold`; Explore sends `status=available` | ✅ Public list returns approved **and** available; React's `approved` PATCH works |
| 7 | Book detail has `seller_id` + nested `seller` (`full_name, city, college_name`) | ✅ `SellerMiniSerializer` (also `user_id`) |
| 8 | `GET /api/books/?seller=me` returns my books, all statuses | ✅ (`?mine=true` also works) |
| 9 | `POST /api/books/` accepts multipart with an `image` file and returns `image_url` | ✅ absolute URL in responses; JSON with `image_url` text also works |
| 10 | `delivery_method` sent with the book | ✅ stored in the extension column `books.delivery_method` (see 3.4) |
| 11 | PATCH for partial updates (mark SOLD, approve, reject), PUT accepted | ✅ |
| 12 | Order body `{ book_id, delivery_method, delivery_address, agreed_price }`; buyer/seller/date set by backend | ✅ `agreed_price` is ignored and taken from the book |
| 13 | `GET /api/chats/` filters `?book_id=` and `?user=` | ✅ also marks incoming messages read when both are given |
| 14 | Admin: `GET /api/users/`, `PATCH /api/users/{id}/ {is_active}` | ✅ 7.2 |
| 15 | Registration role `buyer` or `seller`; any logged-in user may sell | ✅ (optional strict mode in 6.5) |
| 16 | DRF default errors `{field:[msg]}` and `{detail:msg}` | ✅ plus `BadRequest` / `Conflict` helpers for `{detail}` |
| 17 | CORS allows `http://localhost:3000` | ✅ 8.3 |

Extra things the frontend can use: `book_title`, `book_image_url`, `buyer_name`, `seller_name` on orders; `book_title`, `sender_name`, `receiver_name` on chats; `PATCH /api/orders/{id}/` for the seller to accept / complete an order (a nice addition for the **My Orders** page); `GET/PATCH /api/users/me/` for a profile page.

---

## 12. Final Checklist

**Database**
- [ ] Tables `users`, `books`, `orders`, `chats` exist with all SRS columns and foreign keys
- [ ] `users.email` is UNIQUE; passwords are hashed (check a row in Workbench – it must start with `pbkdf2_sha256$`)
- [ ] `books.price` is DECIMAL(10,2); status values match the SRS

**API**
- [ ] All 11 SRS endpoints respond with the status codes in Section 4
- [ ] Supporting endpoints work: token refresh, logout, `me`, admin users, order status, admin orders
- [ ] Search, filters (city, department, college, category, price) and sort (price, newest) work together
- [ ] Image upload saves to `media/books/` and `image_url` opens in the browser

**Rules & security**
- [ ] Only the owner (or admin) can update / delete a listing → others get 403
- [ ] Sold books cannot be ordered; own books cannot be ordered; duplicate active orders blocked
- [ ] Only authenticated users can create listings, orders and chats
- [ ] Chats readable only by sender and receiver
- [ ] Suspended users cannot log in and their old tokens stop working
- [ ] Non-admins get 403 on admin endpoints
- [ ] No password, token or other users' email/phone in any response
- [ ] Secrets only in `.env`

**Integration**
- [ ] React (`localhost:3000`) can register, log in, explore, sell, order and chat without CORS errors
- [ ] `python manage.py test` passes

---

*End of BACKEND.md – BookLoop, One Book, Many Readers!*
