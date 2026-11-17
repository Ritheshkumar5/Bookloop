# BookLoop

**One Book, Many Readers!** BookLoop is a global resale marketplace for college books and study materials. The app is implemented with React, Django REST Framework and MySQL; it does not restrict listings to one college.

For production deployment, follow [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md).

## Project layout

```text
BOOKLOOP/
├── backend/
│   ├── bookloop_backend/
│   ├── core/
│   ├── users/
│   ├── books/
│   ├── orders/
│   ├── chats/
│   └── requirements.txt
└── frontend/
    ├── src/components/
    ├── src/pages/
    ├── src/services/api.js
    └── src/context/AuthContext.js
```

The database contains the four SRS business tables: `users`, `books`, `orders`, and `chats`. The `books.delivery_method` field is the listing preference described in `BACKEND.MD`; the order's delivery choice is saved separately in `orders.delivery_method`. There are no payment, report, or shipment-tracking tables.

## Run the backend (Windows PowerShell, port 8000)

Requirements: Python 3.10+ and a running MySQL 8 server.

1. In MySQL Workbench, create the database and application user (change the password to one of your choice):

   ```sql
   CREATE DATABASE bookloop_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'bookloop_user'@'localhost' IDENTIFIED BY 'ChangeThisPassword!';
   GRANT ALL PRIVILEGES ON bookloop_db.* TO 'bookloop_user'@'localhost';
   FLUSH PRIVILEGES;
   ```

2. Configure and migrate Django:

   ```powershell
   cd C:\Users\acer\OneDrive\BOOKLOOP\backend
   py -m venv .venv
   .\.venv\Scripts\Activate.ps1
   Copy-Item .env.example .env
   # Edit .env and set SECRET_KEY and the DB_* values for your MySQL installation.
   python -m pip install --upgrade pip
   pip install -r requirements.txt
   python manage.py makemigrations users books orders chats
   python manage.py migrate
   python manage.py createsuperuser
   python manage.py runserver 127.0.0.1:8000
   ```

   The custom user model is configured before the first migration. The `createsuperuser` prompt uses email, full name, city, college, department, and password. Its role is `admin`.

3. API base URL: `http://127.0.0.1:8000/api/`. Django admin: `http://127.0.0.1:8000/admin/`.

`PyMySQL` is used as the MySQL driver so installation works on Windows without native compiler tools. To use `mysqlclient` instead, install it and remove the `pymysql.install_as_MySQLdb()` lines from `backend/bookloop_backend/__init__.py`.

## Run the frontend (port 3000)

Open another PowerShell terminal:

```powershell
cd C:\Users\acer\OneDrive\BOOKLOOP\frontend
Copy-Item .env.example .env
# NEXT_PUBLIC_API_URL in .env.example points at http://127.0.0.1:8000.
npm install
npm run dev
```

Open `http://localhost:3000`. To make a production bundle, run `npm run build`.

## Postman smoke test

Use `http://127.0.0.1:8000` as the base URL. JSON requests use `Content-Type: application/json`. After login, use **Authorization → Bearer Token** and paste the `access` token.

1. **Register** — `POST /api/users/register/`

   ```json
   {
     "full_name": "Asha Kumar",
     "email": "asha@example.com",
     "password": "BookLoopPass2026!",
     "phone": "9876543210",
     "city": "Chennai",
     "college_name": "Example University",
     "department": "Computer Science",
     "role": "seller"
   }
   ```

2. **Login** — `POST /api/users/login/` with `{"email":"asha@example.com","password":"BookLoopPass2026!"}`. Copy `access` from the response.
3. **Create a listing** — authenticated `POST /api/books/`. In Postman choose **Body → form-data** and add all required fields from the Sell Book form. Add `image` as a JPG, PNG or WEBP file (maximum 2 MB). The new listing is `pending`.
4. **Approve it** — log in as the admin and send authenticated `PATCH /api/books/{book_id}/` with `{"status":"approved"}`. Public search shows approved/available books only.
5. **Read/search** — `GET /api/books/?search=java&city=Chennai&ordering=-created_at`. Listing details: `GET /api/books/{book_id}/`. Owner inventory: `GET /api/books/?seller=me` with the owner's token.
6. **Update/delete** — owner sends `PATCH /api/books/{book_id}/` with changed fields, or `DELETE /api/books/{book_id}/`. Deletion is rejected with `409` if an order references the listing. Mark a live listing sold with `PATCH` body `{"status":"sold"}`.
7. **Order** — as a different logged-in student, `POST /api/orders/`:

   ```json
   {"book_id": 1, "delivery_method": "meet"}
   ```

   For courier, send `{"book_id":1,"delivery_method":"courier","delivery_address":"12 Example Road, Chennai"}`. `GET /api/orders/my-orders/` shows buyer and seller orders.
8. **Chat** — `POST /api/chats/` with `{"book_id":1,"receiver_id":1,"message":"Is this book available?"}`. Read all conversations with `GET /api/chats/`; filter one with `GET /api/chats/?book_id=1&user=2`.
9. **Admin** — `GET /api/users/` manages student accounts and `PATCH /api/users/{user_id}/` with `{"is_active":false}` suspends a user. `GET /api/orders/` is admin-only.

## Browser walkthrough

Register two accounts, create a listing with the first account, and approve it from `/admin` (or Django admin). Explore and filter the listing on `/`, open its details, request it using the second account, and communicate via Messages. My Listings supports edit/delete/mark sold; My Orders shows buyer and seller requests.

## Implemented API routes

- Users: `POST /api/users/register/`, `POST /api/users/login/`, `POST /api/users/logout/`, `POST /api/users/token/refresh/`, `GET/PATCH /api/users/me/`, admin `GET /api/users/` and `GET/PATCH /api/users/{id}/`.
- Books: `GET/POST /api/books/`, `GET/PUT/PATCH/DELETE /api/books/{id}/`.
- Orders: `POST /api/orders/`, admin `GET /api/orders/`, `GET /api/orders/my-orders/`, participant `GET/PATCH /api/orders/{id}/`.
- Chats: authenticated `GET/POST /api/chats/`.

Online payments, courier tracking, notifications, ratings, and college verification are outside the attached SRS scope.
