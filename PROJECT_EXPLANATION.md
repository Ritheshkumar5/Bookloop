# BookLoop — Complete Project Explanation for Viva

> This guide describes the project as it is implemented in the current `backend/` and `frontend/` code. If an item in an older project plan or requested feature list differs from the code, this guide calls out the difference instead of claiming that the feature exists.

## 1. Project overview

**BookLoop** is a web application where college students can list, find, and request used textbooks and other study materials. The idea is to let study materials move from one student to another instead of remaining unused after a course or exam.

Students sometimes need a particular textbook or notes urgently, especially near exams. A new copy can cost a lot, and a student may not know a nearby person who has a used copy. Buying from an unknown person can also feel risky. BookLoop gives students one place to search listings, check seller information, request a book, talk to the seller, follow an order, and report a problem.

The project is designed around student-to-student exchange. A seller can add a listing with its price, condition, college, city, and delivery preferences. New listings are held for admin approval. Buyers can search and filter the public listings, then request one for a face-to-face meeting or courier delivery. The application does not process a book payment online. For courier handover, it includes a seller confirmation step before the book is given to the rider.

**Purpose:** make used study materials easier to discover, affordable to request, and safer to exchange.

**Target users:** college and university students. Listings can be searched across cities and campuses; the code does not restrict the whole marketplace to one college.

## 2. Technology stack

| Area | Technology in the project | What it does |
|---|---|---|
| Frontend | React 18, JavaScript, Vite | React renders the pages and components. Vite runs the local development server and builds the frontend. |
| Frontend navigation | React Router | Maps paths such as `/`, `/books/:id`, `/my-orders`, and `/admin` to page components. |
| API client | Axios in `frontend/src/services/api.js` | Sends HTTP requests to Django and adds the saved JWT access token to requests. |
| Backend | Django and Django REST Framework (DRF) | Django defines models and URL configuration. DRF provides JSON APIs, serializers, permissions, and request handling. |
| Backend apps | `users`, `books`, `orders`, `chats`, plus shared `core` | Separate account, listing, order/report/rating, conversation, and shared helper logic. |
| Database | Django ORM | Converts Python model operations into database reads and writes. |
| Configured default database | MySQL | `backend/bookloop_backend/settings.py` selects MySQL by default, with settings supplied by environment variables or local defaults. |
| Test database | SQLite in memory | `backend/bookloop_backend/test_settings.py` changes the database to an in-memory SQLite database for tests. |
| Authentication | Simple JWT access and refresh tokens | Login returns JWT tokens; authenticated API calls use `Authorization: Bearer <access-token>`. |

It would therefore be inaccurate to say that the normal project configuration uses SQLite. The main settings use MySQL. SQLite is the configured test database. Django migrations define and update the database schema.

The React source is split into **pages** (complete screens), reusable **components** (such as the book card, filters, and modal), **context** (shared login state), **hooks**, **utilities**, and `services/api.js` (API calls).

## 3. User roles and permissions

There are three role values in the custom user model: `buyer`, `seller`, and `admin`.

### Buyer

A buyer can view public books, filter and search listings, open a listing, send an order request, chat about a book, and view orders in which they are the buyer. A buyer can cancel their own request while it is still active. After a delivered order, the buyer can submit a rating and report the seller. The backend checks that only the buyer on a delivered order can rate it.

### Seller

A seller can create a listing, edit their own listing, see requests on their books, accept or cancel an eligible request, and update delivery/payment progress as the seller on an order. Sellers can communicate with a buyer who started a conversation about their listing. A non-admin can mark their approved listing sold, but cannot set an arbitrary listing status such as approved.

### One student can buy and sell

The signup form asks the student to choose a starting role, and its own text says students can both buy and sell regardless of that choice. Backend listing creation and order creation require an authenticated user; they do not require a separate `seller` or `buyer` role value. The active role is mainly important for identifying an admin. So, for the viva, explain that “buyer” and “seller” describe what the same student is doing in a particular listing or order, not two completely separate account systems.

### Admin

An admin is a user whose role is `admin`. Admin pages and API permissions allow admins to moderate listings, view orders and reports, verify the phone/college flags, and manage user accounts. Admins can approve or reject listings, attach a rejection reason, review reports, warn or block a reported user, and remove a reported listing. The backend blocks normal users from using admin-only endpoints.

## 4. Data models and exact fields

The model fields below are based on `models.py`, not on a proposed schema. Fields marked as a relation point to another model. A Django foreign key is represented in the database with an ID column.

### User

The custom `User` model is in the `users` app. It uses email as the login identifier; it does **not** have a `username` field.

| Field | Meaning |
|---|---|
| `user_id` | Auto-incrementing primary key. |
| `full_name` | User's displayed name. |
| `email` | Unique email address and login name. |
| `password` | Stored as a Django password hash by the user manager; never intended to be displayed. |
| `phone` | Optional phone number. |
| `phone_verified` | Boolean flag; admin can toggle it. |
| `college_id_verified` | Boolean flag; admin can toggle it. |
| `trust_score` | Floating-point average of the user's received star ratings; starts at 0. |
| `city` | User's city. |
| `college_name` | College or university name. |
| `department` | Department. |
| `role` | `buyer`, `seller`, or `admin`. |
| `created_at` | Account creation time. |
| `is_active` | Django active/suspended state. |
| `is_blocked` | App-level blocked state. |
| `warning_message` | Admin's warning or block explanation. |
| `is_staff` | Django staff flag; admin role sets it to true. |

The model also receives authentication and permission fields from Django's base classes, including `last_login`, `is_superuser`, `groups`, and `user_permissions`. These are framework fields, not separate BookLoop business features.

### Book

| Field | Meaning |
|---|---|
| `book_id` | Auto-incrementing primary key. |
| `seller` | Foreign key to the listing's user. |
| `title` | Listing title. |
| `author` | Optional author name. |
| `category` | Textbook, Handwritten Notes, Solved Question Papers, Lab Manual, Reference Book, or Other. |
| `subject` | Subject name. |
| `department` | Department associated with the listing. |
| `college_name` | College or university associated with the listing. |
| `city` | Listing city. |
| `description` | Description of the material. |
| `condition` | New, Like New, Good, or Acceptable. |
| `price` | Positive price with two decimal places. |
| `image_url` | Optional saved image path or URL. Uploaded images may be JPEG, PNG, or WEBP, up to 2 MB. |
| `status` | `pending`, `approved`, `rejected`, `available`, or `sold`. |
| `rejection_reason` | Optional reason set by an admin when rejecting a listing. |
| `created_at` | Listing creation time. |
| `delivery_method` | Listing preference: `meet` or `courier`. |
| `is_urgent` | Boolean urgency flag. |
| `delivery_time` | `WITHIN_1_HOUR`, `SAME_DAY`, or `IN_2_DAYS`. |

The current code uses `status` to represent approval/availability; it does not have a Boolean `is_approved` field. Ordinary public book search shows approved/available items.

### Order

| Field | Meaning |
|---|---|
| `order_id` | Auto-incrementing primary key. |
| `book` | Foreign key to the requested book. |
| `buyer` | Foreign key to the requesting user. |
| `seller` | Foreign key to the book's seller. |
| `order_date` | Creation time. |
| `agreed_price` | Book price copied to the order when created. |
| `delivery_method` | `meet` or `courier`. |
| `delivery_address` | Optional for a meeting; required and trimmed for courier. |
| `payment_method` | `COD` or `MEETUP`. In this app these represent offline payment arrangements, not online payment processing. |
| `payment_status` | `PENDING` or `PAID`. The seller's payment confirmation can set it to `PAID`. |
| `delivery_status` | `CONFIRMED`, `DELIVERY_BOOKED`, `RIDER_ARRIVED`, `PAYMENT_RECEIVED`, `PICKED_UP`, `OUT_FOR_DELIVERY`, `DELIVERED`, or `CANCELLED`. |
| `tracking_id` | Unique ID generated as `BL` followed by six random digits. |
| `delivery_service_charge` | Courier charge amount; cannot be negative through order validation. |
| `delivery_charge_paid_by` | `BUYER` or `SELLER`. |
| `delivery_app` | `DUNZO`, `PORTER`, `RAPIDO`, `SELF`, or blank. |
| `is_urgent` | Boolean urgency choice copied onto the order. |
| `delivery_time` | `WITHIN_1_HOUR`, `SAME_DAY`, or `IN_2_DAYS`. |
| `rider_pickup_otp` | Generated four-digit code. Serializer only returns it to the seller after payment is confirmed. |
| `payment_before_pickup_status` | `NOT_RECEIVED` or `RECEIVED`. |
| `order_status` | `requested`, `accepted`, `completed`, or `cancelled`. |
| `updated_at` | Most recent update time. |

The app's order serializer calls the book reference `book_id` in JSON and exposes associated names and phone values as read-only data. The tracking ID is generated by the model. The OTP is generated by the model too, but the code does not have a rider app or a server endpoint that validates a rider-entered OTP.

### Report

| Field | Meaning |
|---|---|
| `id` | Django-generated primary key. |
| `reporter` | User who submits the report. |
| `reported_user` | User being reported. |
| `book` | Optional related book; the current creation validation requires a book belonging to the reported seller. |
| `reason` | `TOOK_MONEY_NO_BOOK`, `FAKE_BOOK`, `WRONG_BOOK`, or `ABUSIVE_CHAT`. |
| `description` | Optional explanation from the reporter. |
| `status` | `PENDING`, `REVIEWED`, or `ACTION_TAKEN`. |
| `created_at` | Report creation time. |

The backend prevents self-reporting and requires a delivered buyer order for that book and seller before accepting a report.

### Rating

| Field | Meaning |
|---|---|
| `id` | Django-generated primary key. |
| `order` | One-to-one relation to an order, so one rating per order. |
| `rater` | User who submitted it; the API sets this to the authenticated buyer. |
| `rated_user` | User being rated; the API sets this to that order's seller. |
| `stars` | Whole number from 1 through 5. |
| `comment` | Optional review text. |
| `created_at` | Rating creation time. |

After saving a rating, the model recalculates the rated user's `trust_score` as the average of their ratings.

### Chat

There is one `Chat` model for each message; there is no separate `Message` model in the current code.

| Field | Meaning |
|---|---|
| `chat_id` | Auto-incrementing primary key. |
| `book` | Related book listing. |
| `sender` | User who sent the message. |
| `receiver` | User who receives the message. |
| `message` | Message text, limited to 1,000 characters by the serializer. |
| `sent_at` | Message creation time. |
| `is_read` | Read marker; messages are marked read when the receiver opens the matching conversation. |

The database also has `core` helpers, but they are not extra business models. Reports and ratings are defined in the `orders` app.

## 5. Full buying and selling workflow

Here is an example: Asha has a used Biology textbook and Rahul needs it for an upcoming exam.

1. **Asha submits a listing.** She signs in, opens Sell a book, fills in title, subject, condition, price, description, campus and city, and adds an image. The frontend submits the form as multipart data. The API records her as the seller. A non-admin's new listing starts as `pending`.
2. **Admin reviews the listing.** The admin opens the dashboard's Listings tab. They can approve it or reject it with a reason. Public search shows approved/available books, not pending or rejected listings. If Asha edits a rejected listing, the backend resets it to pending so it can be reviewed again.
3. **Rahul searches.** The home page requests books from `GET /api/books/`. It can send text search and filters for city, department, college, category, condition, minimum/maximum price, urgent-only and same-city. Same City uses the signed-in user's city. Search is delayed briefly while a user types, and the results can be sorted and paginated.
4. **Rahul opens the book and requests it.** On the book details page, he clicks Buy now. `BuyNowModal` lets him select meet or courier. Courier requires a delivery address and exposes app, service-charge, charge-payer, delivery-speed, and urgency choices. The current form only enables meetup payment for a face-to-face meeting; courier defaults to COD. It displays “Never pay in advance.”
5. **The order is created.** The frontend sends the selected values to `POST /api/orders/`. The backend checks that Rahul is signed in, the book is public and not sold, Rahul is not ordering his own book, and he does not already have an active request for the same book. The model stores buyer, seller, price, and delivery details, and generates the tracking ID and pickup OTP. The response is HTTP 201. The details page shows a success notice and a link to My Orders.
6. **Asha sees and accepts the request.** Both sides can find their orders in My Orders. Asha sees the request as seller and can accept it. Rahul can cancel a still-requested order; either participant can cancel an active request according to the order transition rules. A seller can accept a requested order; the normal transition rules do not allow the buyer to accept it.
7. **They coordinate by chat.** Either party can view and send messages about the book, subject to backend checks. Messages are fetched periodically by the frontend (every five seconds while a conversation is open); this is polling, not a live socket connection.
8. **They arrange delivery.** For a meetup, they coordinate directly. For a courier, the seller chooses/arranges a courier service outside the app and updates the order's delivery status from My Orders. The app stores the selected delivery app and charge information but does not book a courier or receive live rider updates from Dunzo, Porter, or Rapido.
9. **Rider-arrived safety step.** For courier, the seller can mark `RIDER_ARRIVED`. Both sides see an alert. The seller's screen says not to hand over the book until collecting payment. The buyer's screen asks the buyer to pay the seller via UPI/cash at that point. This is a manually confirmed offline payment; it is not an in-app UPI transfer.
10. **Seller confirms payment before handing over.** The seller clicks “I Received Payment.” The API sets `payment_before_pickup_status` to `RECEIVED`, `payment_status` to `PAID`, and `delivery_status` to `PAYMENT_RECEIVED`. Only after this, the serializer reveals the OTP to the seller. The display says to share it with the rider.
11. **Pickup and delivery progress.** The seller can update the status to picked up, out for delivery, or delivered. The backend rejects pickup/delivery progress if seller payment confirmation is missing. Marking an order delivered completes the order and marks its book sold. The API does not independently check that the rider typed the OTP correctly; the code is shown to the seller as an extra handover detail.
12. **Rahul rates Asha or reports a problem.** After the order reaches delivered, Rahul can rate the seller from one to five stars and add a comment. The seller's average trust score updates. Rahul can also report the seller with one of the supported reasons. These actions require a delivered order for that book.
13. **Admin reviews a report.** Admin can mark the report reviewed, warn the seller with a message, block the seller, or delete the related listing. Blocking sets both `is_blocked` and `is_active=False`, which prevents future login.

## 6. Important safety features and their purpose

### No online book payment in the app

The project does not integrate a payment gateway or accept an advance payment through the API. This reduces the risk of a buyer sending money to a stranger before receiving or checking the book. “COD” in this project's form is an offline payment arrangement, not a card payment handled by BookLoop. For courier orders, the current user interface instructs the buyer to pay the seller when the rider arrives, before the seller hands over the book. This is a manually confirmed offline payment; it is not an in-app UPI transfer. There is a wording mismatch in the current UI: the modal says “Pay only after delivery,” while the courier safety workflow requires payment before the seller hands the book to the rider. In practice, no payment is made through BookLoop, and the seller's recorded confirmation is what gates pickup status.

### Payment before courier pickup

When the rider arrives, the seller is told to collect the book price before handing the book to the rider. The seller's confirmation changes payment and delivery fields. The backend also checks that the payment-before-pickup flag is set before allowing `PICKED_UP`, `OUT_FOR_DELIVERY`, or `DELIVERED`. This is intended to protect the seller from giving away the book without receiving money.

### Four-digit pickup OTP

An order receives a four-digit OTP. It is not shown to everyone: the API serializer returns it to the seller only after the seller confirms payment received. The intended purpose is to let the seller share a pickup code with the arriving rider. Important implementation limit: this project does not include a courier/rider login or an API endpoint that verifies or consumes the OTP. It is displayed as a handover aid; it is not technically validated by the backend.

### Report system

Reports create a record with a reporter, reported seller, book, reason, description, and status. Requiring a delivered order helps connect the report to an actual completed exchange rather than allowing arbitrary reports. Admins can review and take specific actions. It gives students a way to raise issues such as a fake or wrong book, money taken without a book, or abusive chat.

### Rating and verification flags

Ratings give buyers a way to share feedback after a delivered order. The seller's trust score is calculated from received ratings, helping future buyers compare seller histories. Phone and college ID verification are Boolean fields that an admin can toggle from the dashboard. They give a visible trust signal, but the current code does not implement SMS OTP phone verification or an automated college-document verification process.

### “Never pay in advance” reminders

The order modal and details screen display safety reminders about advance payment, meeting in a public place, checking the book, reporting suspicious activity, and not sharing passwords or OTPs in chat. These reminders explain the intended safe behaviour. They do not replace the backend permission checks or prove that a real-world exchange was safe. For courier orders, read the specific seller confirmation alert together with the modal reminder: the code asks for payment at rider arrival, before seller handover, even though the modal's “after delivery” wording suggests a later time.

## 7. Pages and major components

| Page or component | Purpose |
|---|---|
| **HomePage** | Landing page and public book search. Fetches books, applies search/filter/sort parameters, handles loading and errors, and shows the book grid and pagination. |
| **BookDetailsPage** | Shows a selected book's details, price, condition, seller and available safety information. It links to chat, opens the order modal, and after a delivered order allows the buyer to submit a report or rating. |
| **BuyNowModal** | Collects meeting/courier, offline payment method, address, courier app, service charge, who pays, delivery speed, and urgency. Submits the order request. |
| **MyOrdersPage** | Lists the signed-in user's buyer and seller orders, order status and a delivery timeline. Offers order actions, delivery progress updates, payment confirmation, seller-only OTP display, and chat links. |
| **ChatPage** | Shows the user's conversation list and opens a conversation for a book and another user. It groups individual chat records into conversations. |
| **ChatBox** | Loads and sends messages, refreshes the conversation periodically, and displays the warning not to share passwords, OTPs, or sensitive details. |
| **SellBookPage** | Creates a new book listing or edits an existing listing owned by the current user (or handled by an admin). |
| **BookForm** | Reusable listing form with validation, image preview, category, condition, delivery preference, urgency, and delivery speed. |
| **MyListingsPage** | Shows a seller's own listings. Supports edit, mark sold, and delete when allowed. A rejected item can be edited and resubmitted. |
| **AdminDashboardPage** | Has Listings, Users, Orders, and Reports tabs. Admins can moderate listings, verify flags, suspend/activate accounts, and take report actions. |
| **AuthPage** | Provides registration and login forms. Registration asks for student profile details and a starting buyer/seller role. |
| **FilterPanel** | Home page filter controls for city, urgent-only, same-city, department, college, category, condition, and price range. |
| **ProtectedRoute / AdminRoute** | Prevents unauthenticated users from opening protected pages and restricts the admin page to an admin account. |

## 8. Main API endpoints

All paths below are relative to the backend host, for example `http://127.0.0.1:8000`.

| Purpose | Method and endpoint | Access / notes |
|---|---|---|
| Register | `POST /api/users/register/` | Public. Creates an account. |
| Login | `POST /api/users/login/` | Public. Returns `access`, `refresh`, and user information. |
| Logout | `POST /api/users/logout/` | Authenticated. Blacklists the provided refresh token. |
| Refresh JWT | `POST /api/users/token/refresh/` | Uses Simple JWT refresh view. |
| Get or update own profile | `GET/PATCH /api/users/me/` | Authenticated. Patch supports basic profile fields. |
| List or update users | `GET /api/users/`, `GET/PATCH /api/users/{id}/` | Admin only. Search/list and manage verification/account flags. |
| List/search books | `GET /api/books/` | Public. Filters, search, ordering, and pagination are supported. |
| Create a book | `POST /api/books/` | Authenticated. New non-admin listing starts pending. |
| Read a book | `GET /api/books/{id}/` | Public for visible listings; owners/admin can view their relevant listings. |
| Edit/approve/reject/mark sold | `PUT/PATCH /api/books/{id}/` | Authenticated owner or admin; only admin can set admin-only statuses. |
| Delete a book | `DELETE /api/books/{id}/` | Authenticated owner/admin, with restrictions if order history exists. |
| Create order | `POST /api/orders/` | Authenticated. Sends `book_id` and order/delivery choices. |
| Admin list orders | `GET /api/orders/` | Admin-only list. |
| List current user's orders | `GET /api/orders/my-orders/` | Authenticated. Optional `?as=buyer` or `?as=seller`. |
| Read/update an order | `GET/PATCH /api/orders/{id}/` | Order participant or admin. PATCH can change order status, delivery status, or payment-before-pickup status. |
| Create/list reports | `POST/GET /api/orders/reports/` | Authenticated. Users see their own reports; admins can see all. |
| Admin report action | `PATCH /api/orders/reports/{id}/` | Admin only. `action` can be `reviewed`, `warn`, `block`, or `delete_book`. |
| List/create ratings | `GET/POST /api/orders/ratings/` | GET is public; POST requires login and a delivered order buyer. |
| List/send chats | `GET/POST /api/chats/` | Authenticated. Query filters can include `book_id` and `user`. |

**Route accuracy note:** the login route in this code is `/api/users/login/`, not `/api/auth/login/`. There is no separate `/api/orders/{id}/delivery-status/` route. Delivery updates go through `PATCH /api/orders/{id}/` with a `delivery_status` field. The model is called `Chat`; chat endpoints are under `/api/chats/`.

## 9. How an API request works from click to database

The general request path is:

```text
React component
      |
      v
services/api.js
      |
      v
Axios request + Bearer JWT (when signed in)
      |
      v
backend/bookloop_backend/urls.py
      |
      v
app URL route (for example orders/urls.py)
      |
      v
view: permissions and business rules
      |
      v
serializer: validate input and shape output
      |
      v
Django model / ORM
      |
      v
Configured database (MySQL; SQLite for tests)
      |
      v
JSON response
      |
      v
React updates state or shows success/error
```

Serializers are often used for both validation and converting models to JSON. Some view logic checks permissions or workflow rules before saving. For that reason, a simple diagram should not be read as every request going through a separate function in exactly the same order.

### Example A: `POST /api/orders/` — sending a request for a book

1. Rahul clicks **Send order request** in `BuyNowModal.jsx`.
2. The modal's `submit()` function prevents a normal page reload and calls `createOrder()` from `frontend/src/services/api.js`.
3. `createOrder()` sends Axios `POST /api/orders/`. Axios's request interceptor reads the access token from local storage and adds `Authorization: Bearer <token>` if one exists. The JSON body contains `book_id`, `delivery_method`, `delivery_address`, `payment_method`, `delivery_app`, `delivery_service_charge`, `delivery_charge_paid_by`, `delivery_time`, and `is_urgent`.
4. The root `backend/bookloop_backend/urls.py` routes `/api/orders/` to `orders/urls.py`; that file routes the empty subpath to `OrderListCreateView`.
5. The view requires authentication for POST. It asks `OrderSerializer` to validate the input, then runs the creation inside a database transaction and locks the book row while checking it.
6. The view rejects an unavailable/sold listing, a self-order, or a duplicate active request from the same buyer. `OrderSerializer` requires a non-empty delivery address for courier, clears the address for meetup, and rejects a negative service charge.
7. The view saves the `Order` with the signed-in user as buyer, the book's owner as seller, and the current book price as `agreed_price`. `Order` generates the unique `BL` plus six-digit tracking ID and a four-digit OTP.
8. The serializer returns order JSON, including `order_id`, `tracking_id`, and `order_status` (initially `requested`), as an HTTP **201 Created** response.
9. The modal invokes its `onSuccess()` callback. On the book details page, that closes the modal and displays a success message with a link to My Orders.

The endpoint does not return a separate hand-written response containing only three fields: it returns the serialized order record. The example fields above are some of that response.

### Example B: `GET /api/books/` — home page search

1. `HomePage` initializes search and filter state, then calls `getBooks()` when the page loads or the user changes filters.
2. `getBooks(params)` calls Axios `GET /api/books/` and passes cleaned filter values as query parameters, such as `search=biology`, `city=Chennai`, `urgent_only=true`, and `ordering=-created_at`.
3. `BookViewSet` handles list requests. Its `BookFilter` applies city, department, college, category, condition, price, urgency, and same-city filters. DRF's search and ordering backends handle text search and sorting.
4. For a normal public listing, the query is limited to public statuses (`approved` and `available`). Same City uses the authenticated user's city; it cannot work for a signed-out user.
5. DRF serializes the books and returns JSON (usually a paginated object with `results` and `count` under the configured defaults).
6. HomePage puts the returned rows into React state and displays the cards, count, or empty/error state.

### Example C: `POST /api/users/login/` — obtaining JWT tokens

1. The user submits the email and password on `AuthPage`.
2. The auth context calls `loginUser()` from `services/api.js`, which posts JSON to `/api/users/login/`. This route is public and deliberately does not require an existing access token.
3. `LoginView` validates the request shape, looks up the email, and checks the submitted password against Django's stored password hash. It rejects invalid credentials, blocked users, and inactive users.
4. On success, Simple JWT creates an access token and a refresh token. The view returns those strings and serialized user profile data.
5. The auth context stores the access token, refresh token, and user data in local storage and React state. Future Axios calls attach the access token as a Bearer token.

### Example D: `PATCH /api/orders/{id}/` — rider arrival and payment received

1. In My Orders, the seller chooses **Rider Arrived** or **I Received Payment**.
2. The page calls `updateOrderStatus()` with either `{ delivery_status: "RIDER_ARRIVED" }` or `{ payment_before_pickup_status: "RECEIVED" }`.
3. `services/api.js` sends the PATCH to `/api/orders/{id}/`. This is the order detail route; it is not a separate delivery-status subroute.
4. `OrderDetailView` requires an authenticated user who is a participant in the order (or an admin). For delivery/payment changes, it further checks that the requester is the seller.
5. When payment is marked received, the view sets `payment_before_pickup_status=RECEIVED`, `payment_status=PAID`, and `delivery_status=PAYMENT_RECEIVED`. If the seller marks a pickup, out-for-delivery, or delivered status before confirming payment, the backend rejects the request.
6. The API returns the updated serialized order. The serializer exposes the rider OTP only to the seller after payment is recorded. My Orders replaces that order in its React state and shows the new status/timeline.

### Common error responses

| Situation | What happens |
|---|---|
| Missing or invalid JWT for a protected action | DRF normally returns **401 Unauthorized**. For a 401 response, the Axios interceptor removes the saved tokens/user and redirects to login (except for a failed login attempt itself). Some permission failures can be **403 Forbidden** instead, such as blocked login or admin-only access. |
| Invalid form or business data | DRF serializers and views return **400 Bad Request** with details when validation fails, for example a missing courier address, invalid rating, or a pickup before seller payment confirmation. |
| Server/database failure | An unexpected unhandled problem can return **500 Internal Server Error**. The frontend displays an error message where a page handles that request. It should not be treated as a successful order. |

## 10. Admin workflow

The admin dashboard is gated in React by `AdminRoute`, and admin-only backend endpoints also check the user's admin role. Frontend hiding alone is not the security control; the backend performs its own permission checks.

1. **Approve or reject listings:** In Listings, the admin filters statuses, opens a pending listing, and approves or rejects it. A rejection requires a reason. Approving changes its status to approved; rejecting stores the reason and prevents public sale until it is edited and resubmitted.
2. **Verify student details:** In Users, the admin can toggle `phone_verified` and `college_id_verified`. These are manually controlled flags. The code does not send an SMS or inspect a college ID document itself.
3. **Review reports:** Reports show who reported whom, the associated book, reason, description, and report status. Admin actions can mark it reviewed, add a warning, block the account, or delete the book.
4. **Warn or block a seller:** A warning requires a non-empty message. Blocking sets `is_blocked=True`, `is_active=False`, and a warning message. A blocked user is refused at login. Admin can later unblock/activate a user using the user management endpoint.
5. **Review orders:** The Orders tab shows order records, participants, price, delivery type, status, and date. The ordinary dashboard does not present this as an automated dispute-resolution workflow.

## 11. Viva questions and short answers

1. **What is BookLoop?**  
   BookLoop is a web app for students to find, list, and request used books and study materials from other students.

2. **Why did you build it?**  
   Students may urgently need affordable study materials, especially around exams. BookLoop helps them find listings and contact sellers in one place.

3. **Who are the target users?**  
   College and university students who want to buy or sell used study materials.

4. **Can one account both buy and sell?**  
   Yes. A student can request another student's listing and also create their own listing. Buyer/seller identify each user's role in a particular transaction.

5. **What is the frontend built with?**  
   React and Vite, with React Router for page navigation and Axios for HTTP calls.

6. **What is the backend built with?**  
   Django and Django REST Framework. Backend apps separate user, book, order, and chat work.

7. **Which database does the project use?**  
   The standard Django settings configure MySQL. The test settings switch to in-memory SQLite.

8. **Does the user model have a username?**  
   No. The actual custom model uses email as the login identifier and has `full_name`, not `username`.

9. **What is JWT?**  
   JWT means JSON Web Token. After login, the frontend sends the access token in the Bearer Authorization header for protected API requests.

10. **What happens if the token is invalid?**  
    A protected request is rejected, usually with 401. The Axios interceptor clears saved login data and redirects the user to login.

11. **Why does BookLoop not take online payment?**  
    It avoids taking advance payment from a stranger through the app. It is intended to reduce advance-payment fraud risk; no gateway is integrated.

12. **What does COD mean here?**  
    COD means cash on delivery as an offline payment arrangement. BookLoop itself does not process the money.

13. **What is MEETUP payment?**  
    It is the offline arrangement to meet the seller and pay there. The current order form disables it for courier orders.

14. **Who pays the courier charge?**  
    The order stores whether the buyer or seller pays. The buyer can select the payer when placing a courier request.

18. **What happens when the rider arrives?**  
    The seller marks `RIDER_ARRIVED`. The buyer is instructed to pay the seller, and the seller must confirm receipt before handing over the book.

19. **What if the seller has not received payment?**  
    The backend rejects `PICKED_UP`, `OUT_FOR_DELIVERY`, and `DELIVERED` updates until payment-before-pickup is marked received.

20. **What is `payment_before_pickup_status`?**  
    It records `NOT_RECEIVED` or `RECEIVED`. It is a separate safety flag for payment before courier handover.

21. **What is the difference between order status and delivery status?**  
    `order_status` tracks the request lifecycle: requested, accepted, completed, or cancelled. `delivery_status` tracks the delivery steps such as rider arrived, picked up, or delivered.

22. **What is the Urgent Only filter?**  
    It filters for books whose `is_urgent` value is true. It helps a student find listings marked as urgently available.

23. **What does Same City do?**  
    For a signed-in user, it limits results to the user's city. It is disabled for signed-out users in the filter panel.

24. **Why must an admin approve a new book?**  
    New non-admin listings are saved as pending and are not public until moderated. This gives the platform a basic listing review step.

25. **What does the admin do with a rejected book?**  
    The admin provides a rejection reason. The seller can edit it and resubmit; the backend places the edited rejected listing back into pending status.

26. **What is a trust score?**  
    It is the average of the star ratings received by a user. It starts at zero and is recalculated when a rating is saved.

27. **How does rating work?**  
    Only the buyer on a delivered order can rate its seller. The rating has one to five stars and an optional comment; there can be one rating per order.

28. **How does reporting work?**  
    A buyer with a delivered order for that seller and book can submit a reason and description. An admin can review it and take an action.

29. **What reasons can a student choose when reporting?**  
    The code supports took money/no book, fake book, wrong book, and abusive chat.

30. **What happens if a seller gives a fake or wrong book?**  
    The buyer can submit a report after the order is delivered. Admin can review, warn or block the seller, and remove the listing.

31. **How does chat work?**  
    Authenticated users send and fetch messages associated with a book. The backend restricts who can message, and the frontend refreshes every five seconds rather than using WebSockets.

32. **Does the app book a Dunzo or Porter rider automatically?**  
    No. It stores a selected delivery app and lets the seller update delivery progress. The seller arranges the courier outside BookLoop.

33. **Are phone and college IDs verified automatically?**  
    No. They are Boolean flags that an admin can toggle. There is no current SMS-verification or document-checking process.

34. **What does a serializer do?**  
    It checks incoming API data and converts model data to/from JSON. For example, the order serializer checks courier address requirements.

35. **What does a Django model do?**  
    A model defines stored data and relationships. Django's ORM uses models to read and write database records.

36. **What is the first step of an order request?**  
    The buyer submits the Buy Now form, which calls `createOrder()` and sends a POST request to `/api/orders/`.

37. **How does one API URL work from button to database?**  
    The React component calls `services/api.js`; Axios sends the request and token; Django routes it to a view; the view and serializer validate it; the ORM saves it; JSON returns and React updates the page.

38. **What happens if the request has invalid data?**  
    A serializer or view returns a 400 response with an error. The frontend displays the error instead of showing the action as successful.

39. **What statuses can an order have?**  
    Its order status can be requested, accepted, completed, or cancelled. Delivery has its own separate set of statuses.

40. **What would you improve in a future version?**  
    Possible improvements include an optional real payment gateway, SMS notifications, live courier/map tracking, and a rider OTP verification flow. These are future ideas, not features currently implemented.

## 12. How to run the project

The frontend's default API URL points to `http://127.0.0.1:8000`. Start the backend and frontend in separate terminals.

### Backend

The backend's main settings use MySQL by default. Make sure a MySQL server and the configured database are available, or configure the database environment variables for your local setup. The test configuration uses SQLite, but that does not make the regular development server use SQLite automatically.

```powershell
cd C:\Users\acer\OneDrive\BOOKLOOP\backend
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

The backend runs at `http://127.0.0.1:8000`. To use the admin dashboard, create an admin/superuser account using the project's custom user fields and admin role, for example with `python manage.py createsuperuser` after the database is configured.

### Frontend

```powershell
cd C:\Users\acer\OneDrive\BOOKLOOP\frontend
npm install
npm run dev
```

Vite runs the frontend at `http://localhost:3000`. If the backend is hosted somewhere else, set `VITE_API_URL` in the frontend environment configuration to the backend origin.

## 13. Future improvements

These are ideas for later work and are **not currently implemented**:

- Integrate a trusted payment gateway if the product later needs online payment. This would require payment status handling, secure gateway callbacks, refunds, and clear dispute rules.
- Send email or SMS notifications when a seller receives an order request or when the order changes status.
- Integrate courier providers so a delivery can be booked from BookLoop rather than arranged manually.
- Add live rider/map tracking from a real courier service.
- Add a rider-facing app or verification step that validates and consumes the pickup OTP. Today the OTP is generated and displayed to the seller, but not verified by a rider API.
- Add a real phone verification flow and a controlled college ID verification workflow rather than admin-only Boolean toggles.
- Improve automated testing and monitoring for payment, delivery, report, and account moderation workflows.
- Consider adding explicit delivery-state transition checks so a user cannot jump to a later stage by directly calling the API.

These additions should be implemented only after defining the new safety and privacy requirements. The current project is a student-to-student listings and order-coordination application, not a payment processor or courier tracking platform.
