# BookLoop – Frontend Build Guide (FRONTEND.md)

> **BookLoop – One Book, Many Readers!**
> A Global Book Resale Platform for College Students in India
> **Frontend:** React.js · JavaScript · HTML · CSS  |  **Backend (separate):** Django REST Framework + MySQL

This file is a step-by-step build guide. A developer should be able to open it, follow the sections in order, and finish the whole React frontend without needing to open the SRS again. Field names, table names, roles and statuses are taken directly from the SRS (Users, Books, Orders, Chats tables).

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Setup & Folder Structure](#2-setup--folder-structure)
3. [Pages to Build](#3-pages-to-build)
4. [Components List](#4-components-list)
5. [API Integration (axios + JWT)](#5-api-integration-axios--jwt)
6. [State Management, Routing, Styling](#6-state-management-routing-styling)
7. [Validation & Error Handling](#7-validation--error-handling)
8. [Step-by-Step Build Order](#8-step-by-step-build-order)
9. [Final Checklist](#9-final-checklist)
10. [Assumptions to Confirm with Backend](#10-assumptions-to-confirm-with-backend)

---

## 1. Project Overview

**BookLoop** is a web-based resale marketplace where college students buy and sell used educational materials – textbooks, handwritten notes, solved question papers, lab manuals and reference books – at affordable prices.

**Global, not one college.** BookLoop is **not restricted to a single institution**. A student from any college, university, city or state in India can list a book, and a student from a completely different college can discover and buy it. Because of this, the UI must:

- Never assume the user's own college is the only source of books.
- Treat `city`, `college_name` and `department` as **filters**, not as locked values.
- Show the seller's college and city clearly on every card and detail page, so buyers know where the book is.

### 1.1 User roles (from SRS 2.3)

| Role (`users.role`) | Who | What the frontend lets them do |
|---|---|---|
| `buyer` (Junior) | Student looking for affordable material | Explore, search, filter, view details, chat with seller, place order |
| `seller` (Senior) | Student selling used material | Everything a buyer can + create / edit / delete listings, mark SOLD |
| `admin` | Platform manager | Approve / reject listings, manage users, review books & orders |

> **Tip:** Any logged-in student should be able to both buy and sell. The role stored at registration (`buyer` / `seller`) is mainly used for the default landing and for hiding admin features. Only `admin` is hard-restricted. Confirm with backend (see Section 10).

### 1.2 Frontend scope

- **Presentation layer only.** React renders pages, forms, search results, book details and dashboards, sends HTTP requests to Django REST APIs, and shows the JSON responses.
- **No business rules in the frontend** – permissions, duplicate-email checks, "sold items cannot be ordered" etc. are enforced by the backend. The frontend only *mirrors* them for a better user experience (disabling buttons, showing messages).
- **Online payment is out of scope** (SRS 3.4). "Buy Now" creates an **order request**; buyer and seller then agree on meet-up or courier via chat.

### 1.3 Non-functional goals the frontend must meet (SRS 4)

| Requirement | What to do in the frontend |
|---|---|
| User-friendly UI | Simple, consistent layout; clear labels; basic-computer-knowledge friendly |
| Mobile responsive | Mobile-first CSS; works on phone, tablet, laptop, desktop |
| Performance | Debounced search, lazy-loaded images, loading spinners, pagination |
| Security | JWT in `Authorization` header, protected routes, never store passwords, never show raw errors |
| Maintainability | Reusable components, one `api.js`, one `AuthContext`, clear folders |

---

## 2. Setup & Folder Structure

### 2.1 Create the project

```bash
npx create-react-app bookloop-frontend
cd bookloop-frontend
npm install axios react-router-dom
```

(Vite is also fine. This guide uses Create React App naming – `.js` files, `REACT_APP_` env variables. If you use Vite, rename the env variable to `VITE_API_URL` and use `import.meta.env`.)

Create `.env` in the project root:

```env
REACT_APP_API_URL=http://127.0.0.1:8000
```

> **CORS:** Django must allow `http://localhost:3000` (django-cors-headers). If the browser shows a CORS error, it is a backend setting, not a React bug.

### 2.2 Folder structure

```
bookloop-frontend/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── Navbar.js
│   │   ├── Footer.js
│   │   ├── BookCard.js
│   │   ├── BookGrid.js
│   │   ├── SearchBar.js
│   │   ├── FilterPanel.js
│   │   ├── SortDropdown.js
│   │   ├── BookForm.js
│   │   ├── ChatBox.js
│   │   ├── ChatList.js
│   │   ├── MessageBubble.js
│   │   ├── BuyNowModal.js
│   │   ├── StatusBadge.js
│   │   ├── ConfirmDialog.js
│   │   ├── Loader.js
│   │   ├── EmptyState.js
│   │   ├── ErrorMessage.js
│   │   ├── Pagination.js
│   │   ├── Toast.js
│   │   ├── ProtectedRoute.js
│   │   └── AdminRoute.js
│   ├── pages/
│   │   ├── HomePage.js            (Explore Books)
│   │   ├── BookDetailsPage.js
│   │   ├── SellBookPage.js        (create + edit)
│   │   ├── MyListingsPage.js
│   │   ├── MyOrdersPage.js
│   │   ├── AuthPage.js            (Login / Register)
│   │   ├── ChatPage.js
│   │   ├── AdminDashboardPage.js
│   │   └── NotFoundPage.js
│   ├── services/
│   │   └── api.js                 (axios instance + all API functions)
│   ├── context/
│   │   └── AuthContext.js
│   ├── hooks/
│   │   └── useDebounce.js
│   ├── utils/
│   │   ├── constants.js           (categories, conditions, statuses...)
│   │   ├── validators.js
│   │   └── helpers.js             (error parser, price/date formatters)
│   ├── styles/
│   │   ├── variables.css
│   │   ├── global.css
│   │   ├── components.css
│   │   └── pages.css
│   ├── App.js
│   └── index.js
├── .env
└── package.json
```

### 2.3 Shared constants – `src/utils/constants.js`

Create this first. Every dropdown and badge reads from here so values always match the SRS/database.

```js
// Book categories (SRS 3.2) – "Other" is allowed by SRS as "other permitted study materials"
export const CATEGORIES = [
  "Textbook",
  "Handwritten Notes",
  "Solved Question Papers",
  "Lab Manual",
  "Reference Book",
  "Other",
];

// Books.condition (SRS 8.2)
export const CONDITIONS = ["New", "Like New", "Good", "Acceptable"];

// Books.status (SRS 8.2)
export const BOOK_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  AVAILABLE: "available",
  SOLD: "sold",
};

// Orders.delivery_method (SRS 8.3)
export const DELIVERY_METHODS = [
  { value: "meet", label: "Meet in person" },
  { value: "courier", label: "Courier" },
];

// Orders.order_status (SRS 8.3)
export const ORDER_STATUS = ["requested", "accepted", "completed", "cancelled"];

// Users.role (SRS 8.1)
export const ROLES = [
  { value: "buyer", label: "Buyer (looking for books)" },
  { value: "seller", label: "Seller (selling books)" },
];

export const SORT_OPTIONS = [
  { value: "-created_at", label: "Newest first" },
  { value: "price", label: "Price: Low to High" },
  { value: "-price", label: "Price: High to Low" },
];

export const PAGE_SIZE = 12;
export const MAX_IMAGE_MB = 2;
export const TOKEN_KEY = "bookloop_access";
export const REFRESH_KEY = "bookloop_refresh";
export const USER_KEY = "bookloop_user";
```

---

## 3. Pages to Build

Route map (details in Section 6.2):

| Route | Page | Access |
|---|---|---|
| `/` | HomePage (Explore Books) | Public |
| `/books/:id` | BookDetailsPage | Public (Chat / Buy need login) |
| `/login`, `/register` | AuthPage | Public (redirect away if logged in) |
| `/sell` | SellBookPage (create) | Logged in |
| `/sell/:id/edit` | SellBookPage (edit) | Logged in (owner) |
| `/my-listings` | MyListingsPage | Logged in |
| `/my-orders` | MyOrdersPage | Logged in |
| `/chat` | ChatPage (conversation list) | Logged in |
| `/chat/:bookId/:otherUserId` | ChatPage (open conversation) | Logged in |
| `/admin` | AdminDashboardPage | Admin only |
| `*` | NotFoundPage | Public |

---

### 3.1 HomePage / Explore Books  (`/`)

**Purpose (SRS 3.3):** Show approved + available listings from **all colleges in India**; let users search, filter and sort.

**Layout**

```
┌───────────────────────────────────────────────┐
│ Navbar                                        │
├───────────────────────────────────────────────┤
│ Hero: "One Book, Many Readers!"  + SearchBar  │
├───────────────┬───────────────────────────────┤
│ FilterPanel   │ Result count     SortDropdown │
│ (sidebar on   │ ┌────┐ ┌────┐ ┌────┐ ┌────┐   │
│  desktop,     │ │Card│ │Card│ │Card│ │Card│   │
│  drawer on    │ └────┘ └────┘ └────┘ └────┘   │
│  mobile)      │ Pagination                    │
└───────────────┴───────────────────────────────┘
```

**Features**

| Feature | Details |
|---|---|
| Book grid | `BookGrid` of `BookCard`s: 4 columns desktop, 2 tablet, 1–2 mobile |
| Search | One search box → searches **title, author, subject, keyword**. Send as `?search=` |
| Filter: City | Text input or dropdown → `?city=` |
| Filter: Department | → `?department=` |
| Filter: College | → `?college_name=` |
| Filter: Category | Dropdown from `CATEGORIES` → `?category=` |
| Filter: Price | Min and Max number inputs → `?min_price=` & `?max_price=` |
| Optional filters (SRS "may") | Condition → `?condition=` |
| Sort | Price Low→High (`price`), High→Low (`-price`), Newest (`-created_at`) → `?ordering=` |
| Clear filters | Button that resets all filters to default |
| Pagination | `?page=` (12 per page) |

**Behaviour rules**

1. State lives in one `filters` object:
   ```js
   const [filters, setFilters] = useState({
     search: "", city: "", department: "", college_name: "",
     category: "", min_price: "", max_price: "", condition: "",
     ordering: "-created_at", page: 1,
   });
   ```
2. Debounce the search box (400 ms) with `useDebounce` so you do not call the API on every keystroke.
3. Any filter change → reset `page` to `1` → refetch `GET /api/books/`.
4. Remove empty values before sending (don't send `?city=&department=`).
5. **Sold listings must not appear** in default results (SRS 3.6). The backend filters this, but the frontend should also request only `status=available` (see Section 10) and never render a book whose status is `sold` on this page.
6. Show `Loader` while fetching, `EmptyState` ("No books found") when the list is empty, `ErrorMessage` with a Retry button on failure.
7. Sync filters to the URL query string (`useSearchParams`) so a filtered page can be shared/bookmarked and the back button works. *(Nice-to-have.)*

**BookCard content:** image (fallback placeholder if `image_url` is null), title, author, category chip, price (₹), condition, "📍 city · college_name". Whole card links to `/books/{id}`.

---

### 3.2 Book Details Page  (`/books/:id`)

**API:** `GET /api/books/{id}/`

**Show (SRS 3.4 + Books table):**

| UI element | Field |
|---|---|
| Large image | `image_url` |
| Title | `title` |
| Author | `author` (hide row if null) |
| Category chip | `category` – Textbook / Handwritten Notes / Solved Question Papers / Lab Manual / Reference Book |
| Subject | `subject` |
| Department | `department` |
| College | `college_name` |
| City | `city` |
| Condition | `condition` |
| Price | `price` → `₹ 450.00` |
| Description | `description` |
| Status badge | `status` (show red **SOLD** badge if sold) |
| Posted on | `created_at` |
| Seller info card | seller name, city, college (from `seller` object – see Section 10) |

**Buttons**

| Button | Behaviour |
|---|---|
| **💬 Chat with Seller** | Not logged in → redirect to `/login` (remember return URL). Logged in → navigate to `/chat/{book_id}/{seller_id}` |
| **🛒 Buy Now** | Not logged in → `/login`. Logged in → open `BuyNowModal` (choose delivery method + address if courier) → `POST /api/orders/` |

**Rules**

- If `status === "sold"` (or not available): disable **Buy Now**, show "This item has been sold". Chat can stay enabled or hidden – your choice, but be consistent.
- If the logged-in user **is the seller** (`user.user_id === book.seller_id`): hide Chat/Buy and show "This is your listing" with **Edit** link to `/sell/{id}/edit`.
- On successful order: toast "Order request sent! Chat with the seller to arrange delivery." and offer a link to `/my-orders`.
- On 404: show "Book not found" with a link back home.
- Show safety note under chat button: *"Never share passwords or OTPs in chat."* (SRS 3.5)

**Buy Now modal fields (map to Orders table):**

| Field | Source |
|---|---|
| `book_id` | from page |
| `delivery_method` | radio: Meet / Courier |
| `delivery_address` | textarea, **required only if Courier** |
| `agreed_price` | pre-filled with `book.price` (read-only) |

`buyer_id` comes from the JWT on the backend, and `seller_id` comes from the book – do **not** send them from the frontend unless backend asks for it.

---

### 3.3 Sell Book Page  (`/sell` and `/sell/:id/edit`)

One page, two modes: **create** (no `:id`) and **edit** (has `:id`, pre-fill the form via `GET /api/books/{id}/`). Uses the reusable `BookForm` component.

**Form fields (SRS 3.2 + Books table):**

| Field | Input type | Required | Rule |
|---|---|---|---|
| `title` | text | ✅ | 3–200 chars |
| `author` | text | ❌ | max 150 (SRS: "if applicable" – notes/papers may have none) |
| `category` | select (`CATEGORIES`) | ✅ | |
| `subject` | text | ✅ | max 100 |
| `department` | text / select | ✅ | max 100 |
| `college_name` | text | ✅ | max 150 – pre-fill from logged-in user's profile but **editable** |
| `city` | text | ✅ | max 100 – pre-fill from profile, editable |
| `description` | textarea | ✅ | min 10 chars |
| `condition` | select (`CONDITIONS`) | ✅ | |
| `price` | number | ✅ | > 0, max 2 decimals, max `99999999.99` |
| `image` | file upload | ✅ on create / optional on edit | jpg/png/webp, ≤ 2 MB, show preview |
| `delivery_method` | radio: **Meet** / **Courier** | ✅ | seller's preferred way of handover |

> **Note on `delivery_method`:** In the SRS this column lives in the **Orders** table, not Books. The Sell form still collects it (as requested) and sends it with the book. Ask the backend to store it as a listing preference; if they do not, keep it in the description or only use it as the default in `BuyNowModal`. See Section 10.

**Submit flow**

1. Validate on the client (Section 7).
2. Build `FormData` (because of the image file) – see Section 5.5 example.
3. Create → `POST /api/books/`; Edit → `PUT /api/books/{id}/` (or `PATCH`).
4. Disable the submit button and show "Posting…" while waiting (avoids double-posting).
5. Success → toast "Listing submitted! It will appear after admin approval." → navigate to `/my-listings`.
6. Failure → show field-level errors returned by DRF (`{"price": ["A valid number is required."]}`) under each field.

**Notes**

- New listings start as `pending` (admin must approve – SRS 3.7). Tell the seller this clearly.
- Edit mode: only description, condition, image and price are guaranteed editable (SRS 3.2). Keep other fields editable if backend allows; otherwise render them disabled.
- Redirect to login if not authenticated.

---

### 3.4 My Listings Page  (`/my-listings`)

**Purpose (SRS 3.6):** Seller sees **all** their listings (any status) and manages them.

**Data:** `GET /api/books/?seller=me` (or `?mine=true` – confirm with backend). Filter on the client by `seller_id === user.user_id` only as a fallback.

**Layout:** Table on desktop / stacked cards on mobile.

| Column | Field |
|---|---|
| Thumbnail + Title | `image_url`, `title` |
| Category | `category` |
| Price | `price` |
| Status | `status` → `StatusBadge` (Pending = yellow, Approved/Available = green, Rejected = red, Sold = grey) |
| Posted | `created_at` |
| Actions | **Edit**, **Delete**, **Mark as SOLD** |

**Actions**

| Action | API | UI behaviour |
|---|---|---|
| Edit | – | Navigate to `/sell/{id}/edit` |
| Delete | `DELETE /api/books/{id}/` | `ConfirmDialog` first ("Delete this listing? This cannot be undone.") → remove row on success. If backend refuses (e.g. existing orders) show its message |
| Mark as SOLD | `PATCH /api/books/{id}/` with `{ "status": "sold" }` | `ConfirmDialog` → update the badge to SOLD, disable Edit & Mark-as-Sold |

**Empty state:** "You haven't listed any books yet" + **Sell a Book** button.
**Filter tabs (optional):** All · Pending · Available · Sold · Rejected.

---

### 3.5 Login / Register Page  (`/login`, `/register`)

One `AuthPage` with two tabs or two routes that share the same layout.

#### Login – `POST /api/users/login/`

| Field | Rule |
|---|---|
| `email` | required, valid email |
| `password` | required |

Success → backend returns JWT (`access`, `refresh`) and user object → `AuthContext.login()` stores them → redirect to the page the user originally wanted (`location.state.from`) or `/`. Admin → `/admin`.

Failure → "Invalid email or password" (never say which one is wrong).

#### Register – `POST /api/users/register/`

Fields match the **Users table** exactly:

| Field | Input | Required | Rule |
|---|---|---|---|
| `full_name` | text | ✅ | 2–100 chars |
| `email` | email | ✅ | valid format; backend rejects duplicates (SRS 3.1) |
| `password` | password | ✅ | min 8 chars, show/hide toggle |
| confirm password | password | ✅ | frontend-only, must match (do not send) |
| `phone` | tel | ❌ | optional (`VARCHAR(20), NULL`), if filled: 10-digit Indian mobile `^[6-9]\d{9}$` |
| `city` | text | ✅ | max 100 |
| `college_name` | text | ✅ | max 150 |
| `department` | text | ✅ | max 100 |
| `role` | select / radio | ✅ | `buyer` or `seller` (never offer `admin` on this form) |

Success → toast "Account created" → go to Login (or auto-login if backend returns tokens).
Duplicate email → show "This email is already registered" under the email field.

**Logout:** a Navbar button that calls `AuthContext.logout()` (clears tokens + user, redirects `/`).

---

### 3.6 Chat Page  (`/chat`, `/chat/:bookId/:otherUserId`)

**Purpose (SRS 3.5):** Buyer and seller talk about one specific book.

**Data model (Chats table):** `book_id`, `sender_id`, `receiver_id`, `message`, `sent_at`, `is_read`.

**Layout**

```
┌─────────────────┬────────────────────────────────┐
│ ChatList        │ ChatBox                        │
│ (conversations) │ ┌ Book header (img, title, ₹) ┐│
│ ▸ Book A – Ravi │ │ messages (MessageBubble)    ││
│ ▸ Book B – Anu  │ │ ...                         ││
│                 │ └ [ type a message ] [Send]   ┘│
└─────────────────┴────────────────────────────────┘
```
On mobile: show the list first; tapping a conversation shows `ChatBox` full-screen with a back arrow.

**API usage**

| Action | Call |
|---|---|
| Load all my messages (to build the list) | `GET /api/chats/` |
| Load one conversation | `GET /api/chats/?book_id={bookId}&user={otherUserId}` |
| Send a message | `POST /api/chats/` body: `{ "book_id": 5, "receiver_id": 12, "message": "Is this still available?" }` |

`sender_id` comes from the JWT on the backend.

**Conversation grouping (client side):** a "conversation" = unique pair of (`book_id`, other user). Group the flat list from `GET /api/chats/`, show the latest message and an unread dot (`is_read === false && receiver_id === me`).

**Behaviour**

- Messages where `sender_id === user.user_id` → right side (blue); others → left side (grey).
- Show `sent_at` as "10:42 AM" / "Yesterday".
- Auto-scroll to the newest message; **Enter** sends, **Shift+Enter** new line.
- Disable Send when the input is empty/whitespace; max 1000 chars.
- **Poll every 5 seconds** (`setInterval` inside `useEffect`, cleared on unmount) – real-time sockets are not in the SRS scope.
- Pinned warning: *"Do not share passwords, OTPs, or sensitive details."*
- 403 from API → "You are not allowed to view this conversation." (SRS: only participants can view).
- Cannot chat with yourself – hide the Chat button on your own listing.

---

### 3.7 Admin Dashboard Page  (`/admin`)

**Access:** `AdminRoute` – only `user.role === "admin"`; otherwise redirect to `/` with a toast "Admin access only".

**Tabs**

#### Tab 1 – Listings (Approve / Reject)

| Item | Detail |
|---|---|
| List | Pending listings first: `GET /api/books/?status=pending` (admin sees all statuses; add a status filter dropdown) |
| Row info | thumbnail, title, seller, college, city, category, price, `created_at`, status |
| **Approve** | `PATCH /api/books/{id}/` `{ "status": "approved" }` |
| **Reject** | `PATCH /api/books/{id}/` `{ "status": "rejected" }` (optional: ask for a reason in a small modal) |
| Remove | `DELETE /api/books/{id}/` for policy-violating listings (with `ConfirmDialog`) |
| View | Link to `/books/{id}` |

#### Tab 2 – Manage Users

| Item | Detail |
|---|---|
| List | name, email, phone, city, college, department, role, joined date (`created_at`) |
| Search | by name/email (client-side or `?search=`) |
| Suspend / Activate | `PATCH /api/users/{id}/` `{ "is_active": false }` (SRS 3.7: "suspending accounts") |
| Rule | Admin cannot suspend themselves – hide the button on own row |

> The SRS endpoint list does not include user-management endpoints. They are **assumed** (Section 10) – confirm with the backend developer.

#### Tab 3 – Overview (optional, nice for viva demo)

Stat cards: total users, total listings, pending listings, sold listings, total orders (computed from API list lengths / `count`).

---

### 3.8 My Orders Page  (`/my-orders`) – extra page

The SRS endpoint `GET /api/orders/my-orders/` needs a place in the UI.

| Column | Field |
|---|---|
| Book (title + image) | `book_id` → book details |
| Seller | `seller_id` |
| Date | `order_date` |
| Price | `agreed_price` |
| Delivery | `delivery_method` |
| Status | `order_status` (requested / accepted / completed / cancelled) |

Each row has a **Chat with seller** button and a link to the book. Empty state: "You haven't placed any orders yet."

---

## 4. Components List

All components are functional components with hooks. Keep each in its own file under `src/components/`.

| Component | Props (main) | Responsibility |
|---|---|---|
| **Navbar** | – | Logo, Home, Sell Book, My Listings, My Orders, Chat, Admin (if admin), Login/Register or user menu + Logout. Hamburger menu on mobile. Reads `AuthContext` |
| **Footer** | – | Tagline, "Never share OTPs/passwords" notice |
| **BookCard** | `book` | Image, title, author, category chip, price, condition, city/college; links to details |
| **BookGrid** | `books` | Responsive CSS grid that maps `books` to `BookCard` |
| **SearchBar** | `value`, `onChange` | Search input with icon + clear button; placeholder "Search by title, author or subject" |
| **FilterPanel** | `filters`, `onChange`, `onReset` | City, Department, College, Category, Min/Max price, Condition. Collapsible drawer on mobile |
| **SortDropdown** | `value`, `onChange` | Newest / Price asc / Price desc |
| **BookForm** | `initialValues`, `onSubmit`, `submitting`, `mode` | All 12 sell fields, image preview, validation, field errors |
| **BuyNowModal** | `book`, `isOpen`, `onClose`, `onSuccess` | Delivery method + address, calls `createOrder` |
| **StatusBadge** | `status` | Coloured pill for book/order status |
| **ChatList** | `conversations`, `activeKey`, `onSelect` | Left panel of conversations with unread dot |
| **ChatBox** | `bookId`, `otherUserId` | Message list + input, polling, auto-scroll |
| **MessageBubble** | `message`, `isMine` | One chat message with time |
| **ConfirmDialog** | `title`, `message`, `onConfirm`, `onCancel` | Delete / Mark SOLD confirmations |
| **Loader** | `text?` | Spinner (CSS only) |
| **EmptyState** | `title`, `message`, `actionLabel?`, `onAction?` | "No books found" etc. |
| **ErrorMessage** | `message`, `onRetry?` | Red alert box with optional Retry |
| **Pagination** | `page`, `total`, `pageSize`, `onChange` | Prev / numbers / Next |
| **Toast** | via context or `react-toastify` | Success/error notifications |
| **ProtectedRoute** | `children` | Redirects to `/login` if not authenticated (keeps `from`) |
| **AdminRoute** | `children` | Redirects non-admins to `/` |

### 4.1 `Loader.js` (example)

```jsx
export default function Loader({ text = "Loading..." }) {
  return (
    <div className="loader-wrap" role="status" aria-live="polite">
      <div className="spinner" />
      <p>{text}</p>
    </div>
  );
}
```

### 4.2 `ProtectedRoute.js` and `AdminRoute.js`

```jsx
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Loader from "./Loader";

export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loader />;
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return children;
}

export function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  if (loading) return <Loader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}
```

### 4.3 `BookCard.js` (example)

```jsx
import { Link } from "react-router-dom";
import StatusBadge from "./StatusBadge";

const PLACEHOLDER = "/placeholder-book.png"; // put a small image in /public

export default function BookCard({ book }) {
  const id = book.book_id ?? book.id;
  return (
    <Link to={`/books/${id}`} className="book-card">
      <div className="book-card__img-wrap">
        <img
          src={book.image_url || PLACEHOLDER}
          alt={book.title}
          loading="lazy"
          onError={(e) => { e.currentTarget.src = PLACEHOLDER; }}
        />
        {book.status === "sold" && <StatusBadge status="sold" />}
      </div>
      <div className="book-card__body">
        <span className="chip">{book.category}</span>
        <h3 className="book-card__title">{book.title}</h3>
        {book.author && <p className="muted">by {book.author}</p>}
        <p className="book-card__price">₹ {Number(book.price).toLocaleString("en-IN")}</p>
        <p className="muted small">{book.condition}</p>
        <p className="muted small">📍 {book.city} · {book.college_name}</p>
      </div>
    </Link>
  );
}
```

---

## 5. API Integration (axios + JWT)

### 5.1 API summary (from SRS 7.4)

| Purpose | Method | Endpoint | Auth | Used in |
|---|---|---|---|---|
| Register | POST | `/api/users/register/` | No | AuthPage |
| Login | POST | `/api/users/login/` | No | AuthPage |
| List / search books | GET | `/api/books/` | No | HomePage, MyListings, Admin |
| Create listing | POST | `/api/books/` | **Yes** | SellBookPage |
| Book details | GET | `/api/books/{id}/` | No | BookDetailsPage, Edit mode |
| Update listing | PUT / PATCH | `/api/books/{id}/` | **Yes** | Edit, Mark SOLD, Admin approve/reject |
| Delete listing | DELETE | `/api/books/{id}/` | **Yes** | MyListings, Admin |
| Create order | POST | `/api/orders/` | **Yes** | BuyNowModal |
| My orders | GET | `/api/orders/my-orders/` | **Yes** | MyOrdersPage |
| Get chats | GET | `/api/chats/` | **Yes** | ChatPage |
| Send chat | POST | `/api/chats/` | **Yes** | ChatBox |

Admin user management (assumed, not in SRS list): `GET /api/users/`, `PATCH /api/users/{id}/`.

### 5.2 How the JWT flow works

1. User logs in → backend returns `access` (short-lived) and `refresh` tokens.
2. Frontend saves them in `localStorage` (simple and fine for a college project; for production prefer httpOnly cookies).
3. An **axios request interceptor** adds `Authorization: Bearer <access>` to **every** request automatically.
4. An **axios response interceptor** watches for `401` (expired/invalid token), clears the session and sends the user to `/login`.

> If your backend uses DRF `TokenAuthentication` instead of SimpleJWT, change `Bearer` to `Token` in the interceptor. Everything else stays the same.

### 5.3 `src/services/api.js` – full file

```js
import axios from "axios";
import { TOKEN_KEY, REFRESH_KEY, USER_KEY } from "../utils/constants";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://127.0.0.1:8000",
  timeout: 15000,
});

// ---------- Request interceptor: attach JWT ----------
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Let the browser set multipart boundary for FormData
    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ---------- Response interceptor: handle expired token ----------
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const isAuthCall = error.config?.url?.includes("/users/login/");
      if (!isAuthCall) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
        localStorage.removeItem(USER_KEY);
        if (window.location.pathname !== "/login") {
          window.location.href = "/login?expired=1";
        }
      }
    }
    return Promise.reject(error);
  }
);

// ======================= AUTH =======================
export const registerUser = (data) => api.post("/api/users/register/", data);
export const loginUser = (data) => api.post("/api/users/login/", data);

// ======================= BOOKS =======================
export const getBooks = (params = {}) => api.get("/api/books/", { params });
export const getBookById = (id) => api.get(`/api/books/${id}/`);
export const createBook = (formData) => api.post("/api/books/", formData);
export const updateBook = (id, data) => api.put(`/api/books/${id}/`, data);
export const patchBook = (id, data) => api.patch(`/api/books/${id}/`, data);
export const deleteBook = (id) => api.delete(`/api/books/${id}/`);
export const markBookSold = (id) => api.patch(`/api/books/${id}/`, { status: "sold" });

// ======================= ORDERS =======================
export const createOrder = (data) => api.post("/api/orders/", data);
export const getMyOrders = () => api.get("/api/orders/my-orders/");

// ======================= CHATS =======================
export const getChats = (params = {}) => api.get("/api/chats/", { params });
export const sendChat = (data) => api.post("/api/chats/", data);

// ======================= ADMIN (assumed) =======================
export const getUsers = (params = {}) => api.get("/api/users/", { params });
export const updateUser = (id, data) => api.patch(`/api/users/${id}/`, data);

export default api;
```

### 5.4 Example 1 – `GET /api/books/` (Explore page with search + filters)

**Request example:** `GET /api/books/?search=java&city=Chennai&category=Textbook&min_price=100&max_price=500&ordering=price&page=1`

**`src/hooks/useDebounce.js`**

```js
import { useEffect, useState } from "react";

export default function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
```

**`src/pages/HomePage.js`**

```jsx
import { useEffect, useState, useCallback } from "react";
import { getBooks } from "../services/api";
import useDebounce from "../hooks/useDebounce";
import { getErrorMessage, cleanParams } from "../utils/helpers";
import { PAGE_SIZE } from "../utils/constants";
import SearchBar from "../components/SearchBar";
import FilterPanel from "../components/FilterPanel";
import SortDropdown from "../components/SortDropdown";
import BookGrid from "../components/BookGrid";
import Pagination from "../components/Pagination";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import ErrorMessage from "../components/ErrorMessage";

const DEFAULT_FILTERS = {
  search: "", city: "", department: "", college_name: "",
  category: "", condition: "", min_price: "", max_price: "",
  ordering: "-created_at", page: 1,
};

export default function HomePage() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [books, setBooks] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const debouncedSearch = useDebounce(filters.search, 400);

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = cleanParams({
        ...filters,
        search: debouncedSearch,
        status: "available",            // never show sold / pending to buyers
      });
      const res = await getBooks(params);
      // DRF paginated: { count, results }.  Non-paginated: plain array.
      const list = Array.isArray(res.data) ? res.data : res.data.results;
      setBooks(list);
      setTotal(Array.isArray(res.data) ? list.length : res.data.count);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load books. Please try again."));
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, [filters, debouncedSearch]);

  useEffect(() => { fetchBooks(); }, [fetchBooks]);

  // Any filter change goes back to page 1
  const updateFilters = (changes) =>
    setFilters((prev) => ({ ...prev, ...changes, page: changes.page ?? 1 }));

  return (
    <main className="container home">
      <section className="hero">
        <h1>One Book, Many Readers!</h1>
        <p>Buy and sell used study materials with students across India.</p>
        <SearchBar
          value={filters.search}
          onChange={(v) => updateFilters({ search: v })}
        />
      </section>

      <div className="home__layout">
        <FilterPanel
          filters={filters}
          onChange={updateFilters}
          onReset={() => setFilters(DEFAULT_FILTERS)}
        />

        <section className="home__results">
          <div className="home__toolbar">
            <p>{loading ? "Searching…" : `${total} book${total === 1 ? "" : "s"} found`}</p>
            <SortDropdown value={filters.ordering} onChange={(v) => updateFilters({ ordering: v })} />
          </div>

          {loading && <Loader text="Loading books..." />}

          {!loading && error && <ErrorMessage message={error} onRetry={fetchBooks} />}

          {!loading && !error && books.length === 0 && (
            <EmptyState
              title="No books found"
              message="Try a different keyword or clear some filters."
              actionLabel="Clear filters"
              onAction={() => setFilters(DEFAULT_FILTERS)}
            />
          )}

          {!loading && !error && books.length > 0 && (
            <>
              <BookGrid books={books} />
              <Pagination
                page={filters.page}
                total={total}
                pageSize={PAGE_SIZE}
                onChange={(p) => setFilters((f) => ({ ...f, page: p }))}
              />
            </>
          )}
        </section>
      </div>
    </main>
  );
}
```

### 5.5 Example 2 – `POST /api/books/` (Sell Book with image upload)

Because the form includes an **image file**, send `multipart/form-data` using `FormData` – **not** JSON. The axios interceptor above already removes the manual `Content-Type` so the browser adds the correct boundary.

**`src/pages/SellBookPage.js`**

```jsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createBook, getBookById, patchBook } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage, getFieldErrors } from "../utils/helpers";
import { validateBook } from "../utils/validators";
import BookForm from "../components/BookForm";
import Loader from "../components/Loader";
import ErrorMessage from "../components/ErrorMessage";

export default function SellBookPage() {
  const { id } = useParams();            // present only in edit mode
  const isEdit = Boolean(id);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [initial, setInitial] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  // Edit mode: pre-fill the form
  useEffect(() => {
    if (!isEdit) {
      setInitial({
        title: "", author: "", category: "", subject: "", department: user?.department || "",
        college_name: user?.college_name || "", city: user?.city || "",
        description: "", condition: "", price: "", delivery_method: "meet", image: null,
      });
      return;
    }
    (async () => {
      try {
        const { data } = await getBookById(id);
        setInitial({ ...data, image: null, existingImage: data.image_url });
      } catch (err) {
        setFormError(getErrorMessage(err, "Could not load this listing."));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit, user]);

  const handleSubmit = async (values) => {
    setFormError("");
    const errors = validateBook(values, { isEdit });
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    // Build multipart body
    const fd = new FormData();
    ["title", "author", "category", "subject", "department", "college_name",
     "city", "description", "condition", "price", "delivery_method"].forEach((key) => {
      if (values[key] !== undefined && values[key] !== null) fd.append(key, values[key]);
    });
    if (values.image) fd.append("image", values.image);   // backend stores it and returns image_url

    setSubmitting(true);
    try {
      if (isEdit) await patchBook(id, fd);   // PATCH = only changed/sent fields
      else await createBook(fd);             // POST /api/books/
      navigate("/my-listings", {
        state: { message: isEdit
          ? "Listing updated."
          : "Listing submitted! It will appear after admin approval." },
      });
    } catch (err) {
      setFieldErrors(getFieldErrors(err));   // e.g. { price: "A valid number is required." }
      setFormError(getErrorMessage(err, "Could not save the listing."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !initial) return <Loader />;

  return (
    <main className="container narrow">
      <h1>{isEdit ? "Edit Listing" : "Sell a Book"}</h1>
      {formError && <ErrorMessage message={formError} />}
      <BookForm
        mode={isEdit ? "edit" : "create"}
        initialValues={initial}
        errors={fieldErrors}
        submitting={submitting}
        onSubmit={handleSubmit}
      />
    </main>
  );
}
```

> If the backend expects JSON and takes `image_url` as plain text instead of a file, send a normal JSON object with `image_url` filled from an upload service. Agree on this with the backend developer **before** building `BookForm` (Section 10).

### 5.6 Other API call examples

**Login (`AuthContext` calls this):**
```js
const { data } = await loginUser({ email, password });
// expected: { access, refresh, user: { user_id, full_name, email, role, city, college_name, department, phone } }
```

**Create order (Buy Now):**
```js
await createOrder({
  book_id: book.book_id ?? book.id,
  delivery_method: "meet",          // or "courier"
  delivery_address: "",             // required only for courier
  agreed_price: book.price,
});
```

**Mark as SOLD:**
```js
await markBookSold(bookId);   // PATCH /api/books/{id}/ { status: "sold" }
```

**Send chat message:**
```js
await sendChat({ book_id: 5, receiver_id: 12, message: "Is this still available?" });
```

### 5.7 `src/utils/helpers.js`

```js
// Remove empty values so we do not send ?city=&department=
export const cleanParams = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== "" && v !== null && v !== undefined)
  );

// Turn any axios error into a friendly string
export function getErrorMessage(err, fallback = "Something went wrong. Please try again.") {
  if (!err.response) {
    return err.code === "ECONNABORTED"
      ? "The server took too long to respond. Please try again."
      : "Cannot reach the server. Check your internet connection.";
  }
  const { status, data } = err.response;
  if (status === 401) return "Please log in to continue.";
  if (status === 403) return "You do not have permission to do this.";
  if (status === 404) return "The item you are looking for was not found.";
  if (status >= 500) return "Server error. Please try again later.";
  if (typeof data === "string") return fallback;
  if (data?.detail) return data.detail;
  if (data?.error) return data.error;
  if (data?.non_field_errors) return data.non_field_errors[0];
  return fallback;
}

// DRF field errors: { price: ["Invalid"], title: ["Required"] } -> { price: "Invalid", title: "Required" }
export function getFieldErrors(err) {
  const data = err.response?.data;
  if (!data || typeof data !== "object") return {};
  const out = {};
  Object.entries(data).forEach(([k, v]) => {
    out[k] = Array.isArray(v) ? v[0] : String(v);
  });
  return out;
}

export const formatPrice = (p) => `₹ ${Number(p).toLocaleString("en-IN")}`;
export const formatDate = (d) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
```

---

## 6. State Management, Routing, Styling

### 6.1 State management

No Redux needed. Use React built-ins:

| What | Where | Tool |
|---|---|---|
| Logged-in user, token, login/logout | Global | **`AuthContext`** (Context API) |
| Search + filters + results | HomePage | `useState` + `useEffect` |
| Form values, errors, submitting | Each form | `useState` |
| Chat messages | ChatBox | `useState` + polling `useEffect` |
| Toasts | Global | small `ToastContext` or `react-toastify` |

**`src/context/AuthContext.js`**

```jsx
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { loginUser, registerUser } from "../services/api";
import { TOKEN_KEY, REFRESH_KEY, USER_KEY } from "../utils/constants";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);   // true until localStorage is checked

  // Restore session on page refresh
  useEffect(() => {
    try {
      const t = localStorage.getItem(TOKEN_KEY);
      const u = localStorage.getItem(USER_KEY);
      if (t && u) {
        setToken(t);
        setUser(JSON.parse(u));
      }
    } catch {
      localStorage.clear();
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await loginUser({ email, password });
    localStorage.setItem(TOKEN_KEY, data.access);
    if (data.refresh) localStorage.setItem(REFRESH_KEY, data.refresh);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setToken(data.access);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback((payload) => registerUser(payload), []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = {
    user,
    token,
    loading,
    isAuthenticated: Boolean(token && user),
    isAdmin: user?.role === "admin",
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};
```

**`src/index.js`**

```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import "./styles/variables.css";
import "./styles/global.css";
import "./styles/components.css";
import "./styles/pages.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>
);
```

### 6.2 Routing (react-router-dom v6)

**`src/App.js`**

```jsx
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { ProtectedRoute, AdminRoute } from "./components/ProtectedRoute";
import HomePage from "./pages/HomePage";
import BookDetailsPage from "./pages/BookDetailsPage";
import AuthPage from "./pages/AuthPage";
import SellBookPage from "./pages/SellBookPage";
import MyListingsPage from "./pages/MyListingsPage";
import MyOrdersPage from "./pages/MyOrdersPage";
import ChatPage from "./pages/ChatPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import NotFoundPage from "./pages/NotFoundPage";

export default function App() {
  return (
    <>
      <Navbar />
      <div className="app-content">
        <Routes>
          {/* Public */}
          <Route path="/" element={<HomePage />} />
          <Route path="/books/:id" element={<BookDetailsPage />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />

          {/* Logged-in users */}
          <Route path="/sell" element={<ProtectedRoute><SellBookPage /></ProtectedRoute>} />
          <Route path="/sell/:id/edit" element={<ProtectedRoute><SellBookPage /></ProtectedRoute>} />
          <Route path="/my-listings" element={<ProtectedRoute><MyListingsPage /></ProtectedRoute>} />
          <Route path="/my-orders" element={<ProtectedRoute><MyOrdersPage /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
          <Route path="/chat/:bookId/:otherUserId" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />

          {/* Admin only */}
          <Route path="/admin" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
      <Footer />
    </>
  );
}
```

> Export both `ProtectedRoute` and `AdminRoute` from the same file (as in 4.2) or split them – just keep the imports consistent.

**Redirect after login:**

```js
const from = location.state?.from || "/";
navigate(loggedInUser.role === "admin" ? "/admin" : from, { replace: true });
```

### 6.3 Styling – plain CSS, mobile responsive

Use **plain CSS** (HTML + CSS as per the SRS stack). No Tailwind/Bootstrap required. Design **mobile-first**: write base styles for phones, then add `@media (min-width: …)` for larger screens.

**`src/styles/variables.css`**

```css
:root {
  --color-primary: #2563eb;
  --color-primary-dark: #1d4ed8;
  --color-accent: #f59e0b;
  --color-success: #16a34a;
  --color-danger: #dc2626;
  --color-warning: #ca8a04;
  --color-bg: #f8fafc;
  --color-surface: #ffffff;
  --color-text: #0f172a;
  --color-muted: #64748b;
  --color-border: #e2e8f0;

  --radius: 12px;
  --shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
  --gap: 1rem;
  --container: 1200px;
  --font: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
```

**`src/styles/global.css` (essentials)**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: var(--font); background: var(--color-bg); color: var(--color-text); line-height: 1.5; }
img { max-width: 100%; display: block; }
a { color: inherit; text-decoration: none; }
button { font: inherit; cursor: pointer; }
.container { width: 100%; max-width: var(--container); margin: 0 auto; padding: 0 var(--gap); }
.container.narrow { max-width: 720px; }
.muted { color: var(--color-muted); }
.small { font-size: 0.85rem; }

.btn { padding: 0.65rem 1.1rem; border: 0; border-radius: 8px; font-weight: 600; }
.btn-primary { background: var(--color-primary); color: #fff; }
.btn-primary:hover { background: var(--color-primary-dark); }
.btn-danger { background: var(--color-danger); color: #fff; }
.btn-outline { background: transparent; border: 1px solid var(--color-border); }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }

.field { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 1rem; }
.field input, .field select, .field textarea {
  padding: 0.65rem 0.8rem; border: 1px solid var(--color-border); border-radius: 8px; font: inherit;
}
.field.has-error input, .field.has-error select, .field.has-error textarea { border-color: var(--color-danger); }
.field-error { color: var(--color-danger); font-size: 0.85rem; }

.spinner { width: 36px; height: 36px; border: 4px solid var(--color-border);
  border-top-color: var(--color-primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
```

**Responsive grid + layout (`components.css` / `pages.css`)**

```css
/* Book grid: 1 col phone, 2 tablet, 3 laptop, 4 desktop */
.book-grid { display: grid; gap: var(--gap); grid-template-columns: repeat(1, 1fr); }
@media (min-width: 480px)  { .book-grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 900px)  { .book-grid { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1200px) { .book-grid { grid-template-columns: repeat(4, 1fr); } }

/* Home: filters stack on top on mobile, sidebar on desktop */
.home__layout { display: grid; gap: var(--gap); grid-template-columns: 1fr; }
@media (min-width: 900px) { .home__layout { grid-template-columns: 260px 1fr; } }

/* Navbar: hamburger under 768px */
.navbar__links { display: none; }
.navbar__links.open { display: flex; flex-direction: column; }
@media (min-width: 768px) { .navbar__links { display: flex; flex-direction: row; gap: 1rem; } .navbar__burger { display: none; } }

/* Book details: image above info on mobile, side-by-side on desktop */
.details { display: grid; gap: 1.5rem; grid-template-columns: 1fr; }
@media (min-width: 800px) { .details { grid-template-columns: 1fr 1.2fr; } }

/* Chat: single column mobile, two columns desktop */
.chat { display: grid; grid-template-columns: 1fr; height: calc(100vh - 140px); }
@media (min-width: 800px) { .chat { grid-template-columns: 300px 1fr; } }
.bubble { max-width: 75%; padding: 0.55rem 0.8rem; border-radius: 14px; margin-bottom: 0.4rem; }
.bubble.mine { margin-left: auto; background: var(--color-primary); color: #fff; }
.bubble.theirs { margin-right: auto; background: #e2e8f0; }

/* Tables become cards on small screens (My Listings, Admin) */
@media (max-width: 700px) {
  table.responsive thead { display: none; }
  table.responsive tr { display: block; margin-bottom: 1rem; background: var(--color-surface);
    border-radius: var(--radius); box-shadow: var(--shadow); padding: 0.5rem; }
  table.responsive td { display: flex; justify-content: space-between; padding: 0.35rem 0.5rem; }
  table.responsive td::before { content: attr(data-label); font-weight: 600; color: var(--color-muted); }
}
```

**Responsive checklist**

- `<meta name="viewport" content="width=device-width, initial-scale=1" />` in `public/index.html`.
- Touch targets at least 44 px high.
- Test at 360 px (small phone), 768 px (tablet), 1280 px (laptop) in Chrome DevTools.
- No horizontal scrolling at any width.
- Use semantic HTML (`<nav>`, `<main>`, `<section>`, `<label htmlFor>`) and `alt` text on images.

---

## 7. Validation & Error Handling

### 7.1 Principle

Validate in the frontend for **fast feedback**, but always trust the backend as the final authority. Show backend errors returned by Django under the matching field.

### 7.2 `src/utils/validators.js`

```js
import { MAX_IMAGE_MB } from "./constants";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[6-9]\d{9}$/;   // Indian mobile

export function validateRegister(v) {
  const e = {};
  if (!v.full_name?.trim() || v.full_name.trim().length < 2) e.full_name = "Enter your full name.";
  if (!EMAIL_RE.test(v.email || "")) e.email = "Enter a valid email address.";
  if (!v.password || v.password.length < 8) e.password = "Password must be at least 8 characters.";
  if (v.password !== v.confirm_password) e.confirm_password = "Passwords do not match.";
  if (v.phone && !PHONE_RE.test(v.phone)) e.phone = "Enter a valid 10-digit mobile number.";
  if (!v.city?.trim()) e.city = "City is required.";
  if (!v.college_name?.trim()) e.college_name = "College name is required.";
  if (!v.department?.trim()) e.department = "Department is required.";
  if (!["buyer", "seller"].includes(v.role)) e.role = "Select how you will use BookLoop.";
  return e;
}

export function validateLogin(v) {
  const e = {};
  if (!EMAIL_RE.test(v.email || "")) e.email = "Enter a valid email address.";
  if (!v.password) e.password = "Password is required.";
  return e;
}

export function validateBook(v, { isEdit = false } = {}) {
  const e = {};
  if (!v.title?.trim() || v.title.trim().length < 3) e.title = "Title must be at least 3 characters.";
  if (v.title?.length > 200) e.title = "Title is too long (max 200).";
  if (v.author && v.author.length > 150) e.author = "Author name is too long (max 150).";
  if (!v.category) e.category = "Select a category.";
  if (!v.subject?.trim()) e.subject = "Subject is required.";
  if (!v.department?.trim()) e.department = "Department is required.";
  if (!v.college_name?.trim()) e.college_name = "College name is required.";
  if (!v.city?.trim()) e.city = "City is required.";
  if (!v.description?.trim() || v.description.trim().length < 10) e.description = "Add a short description (min 10 characters).";
  if (!v.condition) e.condition = "Select the condition.";

  const price = Number(v.price);
  if (v.price === "" || Number.isNaN(price) || price <= 0) e.price = "Enter a price greater than 0.";
  else if (!/^\d+(\.\d{1,2})?$/.test(String(v.price))) e.price = "Price can have at most 2 decimal places.";

  if (!["meet", "courier"].includes(v.delivery_method)) e.delivery_method = "Choose a delivery method.";

  if (!isEdit && !v.image) e.image = "Upload a photo of the item.";
  if (v.image) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(v.image.type)) e.image = "Only JPG, PNG or WEBP images are allowed.";
    else if (v.image.size > MAX_IMAGE_MB * 1024 * 1024) e.image = `Image must be smaller than ${MAX_IMAGE_MB} MB.`;
  }
  return e;
}

export function validateOrder(v) {
  const e = {};
  if (!v.delivery_method) e.delivery_method = "Choose a delivery method.";
  if (v.delivery_method === "courier" && !v.delivery_address?.trim()) {
    e.delivery_address = "Delivery address is required for courier.";
  }
  return e;
}

export function validateMessage(text) {
  if (!text.trim()) return "Type a message first.";
  if (text.length > 1000) return "Message is too long (max 1000 characters).";
  return "";
}
```

### 7.3 Scenarios & required UI behaviour

| # | Scenario | What the user sees |
|---|---|---|
| 1 | **Empty search results** | `EmptyState`: "No books found" + "Try a different keyword or clear some filters" + **Clear filters** button |
| 2 | **No listings on platform at all** | "No books have been listed yet. Be the first to sell one!" + **Sell a Book** button |
| 3 | **My Listings empty** | "You haven't listed any books yet." + **Sell a Book** |
| 4 | **My Orders empty** | "You haven't placed any orders yet." + **Browse Books** |
| 5 | **No chats yet** | "No conversations yet. Open a book and tap Chat with Seller." |
| 6 | **Not logged in, opens protected page** | Redirect to `/login` with message "Please log in to continue"; after login return to the original page |
| 7 | **Not logged in, taps Chat/Buy** | Same redirect, return to the book afterward |
| 8 | **Token expired (401)** | Axios interceptor clears session → `/login?expired=1` → banner "Your session expired. Please log in again." |
| 9 | **Non-admin opens `/admin`** | Redirect home + toast "Admin access only" |
| 10 | **403 Forbidden** (e.g. editing someone else's listing, reading someone else's chat) | "You do not have permission to do this." |
| 11 | **404 book not found** | "Book not found" page with **Back to Home** |
| 12 | **Network down / server off** | "Cannot reach the server. Check your internet connection." + **Retry** |
| 13 | **500 server error** | "Server error. Please try again later." (never show stack traces) |
| 14 | **Duplicate email on register** | Field error under email: "This email is already registered." |
| 15 | **Wrong login** | "Invalid email or password." (generic) |
| 16 | **Order for sold item** | Buy button disabled + "This item has been sold." If backend returns 400 anyway, show its message and refresh the book |
| 17 | **Image too big / wrong type** | Inline error under the file input *before* upload |
| 18 | **Form submit in progress** | Button disabled, text "Posting…", prevent double click |
| 19 | **Image fails to load** | `onError` swaps to a placeholder image |
| 20 | **Pending/rejected listing** | `StatusBadge` on My Listings; rejected shows "Rejected by admin" |

### 7.4 Error-handling rules (apply everywhere)

1. Every `await api…` call is inside `try / catch / finally`.
2. `finally` always turns the loading flag off.
3. Use `getErrorMessage(err)` for banners and `getFieldErrors(err)` for form fields.
4. Clear old errors at the start of each new request.
5. Destructive actions (delete, mark SOLD, reject, suspend) always use `ConfirmDialog`.
6. After a successful action, update the UI immediately (remove the row, change the badge) or refetch.
7. Never display raw `err.message`, HTML error pages, or tokens to the user.
8. Do not log passwords or tokens to the console.

---

## 8. Step-by-Step Build Order

Follow this order so every step is testable on its own.

| Step | Task | Done when |
|---|---|---|
| **1** | Create the app, install `axios react-router-dom`, add `.env`, create folders from Section 2.2 | `npm start` shows the default page |
| **2** | Write `constants.js`, `variables.css`, `global.css` | Colors/fonts apply |
| **3** | Build `api.js` (axios instance + interceptors + all functions) | Postman-tested endpoints respond via a quick console call |
| **4** | Build `AuthContext`, wrap `<App/>`, add `BrowserRouter` | `useAuth()` works in any component |
| **5** | Build shared UI: `Loader`, `EmptyState`, `ErrorMessage`, `StatusBadge`, `ConfirmDialog`, `Toast` | Each renders alone |
| **6** | Build `Navbar` (+ mobile menu) and `Footer`, `ProtectedRoute`, `AdminRoute`, routes in `App.js` | Links change pages; guarded pages redirect |
| **7** | Build **AuthPage** (Register + Login) with validators | Can register, log in, see user name in Navbar, log out, refresh keeps session |
| **8** | Build `BookCard`, `BookGrid`, **HomePage** with plain `GET /api/books/` | Real books appear in the grid |
| **9** | Add `SearchBar`, `FilterPanel`, `SortDropdown`, `Pagination`, debounce | Search/filter/sort all change results; "No books found" works |
| **10** | Build **BookDetailsPage** (display only) | All fields from Section 3.2 are shown |
| **11** | Build `BookForm` + **SellBookPage** (create) | New listing is created with image; appears as pending |
| **12** | Build **MyListingsPage** (Edit, Delete, Mark SOLD) + edit mode of SellBookPage | Full CRUD works for a seller |
| **13** | Add `BuyNowModal` + `POST /api/orders/` + **MyOrdersPage** | Order is placed; sold items cannot be ordered |
| **14** | Build **ChatPage**, `ChatList`, `ChatBox`, `MessageBubble` + polling | Two accounts can exchange messages about a book |
| **15** | Build **AdminDashboardPage** (Listings tab, Users tab) | Admin can approve/reject and suspend |
| **16** | Responsive pass at 360 / 768 / 1280 px | No overflow, all features usable on phone |
| **17** | Error-handling pass: go through the 20 scenarios in Section 7.3 | Every scenario shows the right message |
| **18** | Cleanup: remove `console.log`, unused code, test full flow end-to-end | Checklist in Section 9 is all ticked |

---

## 9. Final Checklist

**Functional**

- [ ] Register with all Users-table fields; duplicate email rejected
- [ ] Login / logout; session survives page refresh
- [ ] Explore shows only available listings; works for books from any college/city
- [ ] Search by title / author / subject; filter by city, department, college, category, price; sort by price / newest
- [ ] Book details show every field listed in 3.2 + seller info
- [ ] Sell form has all 12 fields; image upload with preview; client validation
- [ ] My Listings: edit, delete, mark SOLD; sold items labelled and excluded from Explore
- [ ] Buy Now creates an order; sold/own items blocked
- [ ] Chat per book with sender/receiver; polling works; only participants can read
- [ ] Admin: approve, reject, remove listings; view and suspend users
- [ ] My Orders page lists orders from `/api/orders/my-orders/`

**Quality**

- [ ] JWT is attached automatically to all protected calls; 401 handled globally
- [ ] Every page has loading, empty and error states
- [ ] Mobile responsive at 360 px, 768 px and 1280 px
- [ ] Forms prevent double submit
- [ ] No hard-coded API URL (uses `REACT_APP_API_URL`)
- [ ] No secrets/tokens printed in the console

---

## 10. Assumptions to Confirm with Backend

The SRS marks its endpoint paths as *illustrative* and leaves some details open. The frontend above assumes the following – **agree on these with the Django developer before Step 3**, and update `api.js` if anything differs.

| # | Topic | Frontend assumption | If different |
|---|---|---|---|
| 1 | **Login response** | `{ access, refresh, user: { user_id, full_name, email, role, city, college_name, department, phone } }` | Adjust `AuthContext.login()` |
| 2 | **Auth header** | `Authorization: Bearer <access>` (SimpleJWT) | Use `Token <key>` for DRF token auth |
| 3 | **Book ID field** | Books return `book_id` or `id` – code uses `book.book_id ?? book.id` | Standardise on one |
| 4 | **Book list query params** | `search`, `city`, `department`, `college_name`, `category`, `condition`, `min_price`, `max_price`, `ordering`, `page`, `status` | Rename keys in `HomePage` / `cleanParams` |
| 5 | **Pagination** | DRF `PageNumberPagination` → `{ count, results }` (page size 12). A plain array is also handled | – |
| 6 | **Status values** | `pending`, `approved`, `rejected`, `available`, `sold`. Admin approval moves a listing to `approved` or `available`; the Explore page asks for `status=available` | Change `BOOK_STATUS` and the Explore param (e.g. accept both) |
| 7 | **Seller info on a book** | Book detail includes `seller_id` plus a nested `seller` object (`full_name`, `city`, `college_name`) | Otherwise add a seller-info endpoint |
| 8 | **My listings** | `GET /api/books/?seller=me` returns only my books, all statuses | Use `?mine=true` or filter on the client |
| 9 | **Image upload** | `POST /api/books/` accepts `multipart/form-data` with an `image` file and returns `image_url` | If JSON-only, upload the image elsewhere first and send `image_url` |
| 10 | **`delivery_method` on Books** | The SRS puts it in **Orders**; the Sell form still sends it with the book | Ask backend to add it to Books, or drop it from the form / use it only as a default in `BuyNowModal` |
| 11 | **Update method** | `PATCH` for partial updates (mark SOLD, approve, reject); `PUT` accepted for full edits | – |
| 12 | **Order create** | Body `{ book_id, delivery_method, delivery_address, agreed_price }`; backend fills `buyer_id`, `seller_id`, `order_date` from token/book | Send the IDs if backend requires them |
| 13 | **Chat filters** | `GET /api/chats/` returns messages where I am sender or receiver; supports `?book_id=` and `?user=` | Group/filter on the client |
| 14 | **Admin user management** | `GET /api/users/` (admin only) and `PATCH /api/users/{id}/` with `{ is_active }` | Not in the SRS endpoint list but required by SRS 3.7 – backend must add them |
| 15 | **Roles** | Registration allows `buyer` or `seller`; any logged-in user may buy and sell; `admin` is created only by the backend | Gate Sell page by `role === "seller"` if you want strict roles |
| 16 | **Error format** | DRF default: `{ "field": ["message"] }` and `{ "detail": "message" }` | Update `getErrorMessage` / `getFieldErrors` |
| 17 | **CORS** | Django allows the React dev origin (`http://localhost:3000`) | Fix `CORS_ALLOWED_ORIGINS` on backend |

---

*End of FRONTEND.md – BookLoop, One Book, Many Readers!*
