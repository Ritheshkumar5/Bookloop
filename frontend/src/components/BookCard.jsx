import { Link } from "react-router-dom";
import { formatPrice } from "../utils/helpers";
import StatusBadge from "./StatusBadge";

const PLACEHOLDER = "/placeholder-book.svg";

export default function BookCard({ book }) {
  return (
    <Link to={`/books/${book.book_id}`} className="book-card">
      <div className="book-card-image">
        <img
          src={book.image_url || PLACEHOLDER}
          alt={book.title}
          loading="lazy"
          onError={(event) => { event.currentTarget.src = PLACEHOLDER; }}
        />
        {book.status === "sold" && <StatusBadge status="sold" />}
        {book.is_urgent && <span className="book-trust-badge urgent-badge">URGENT - Available Today</span>}
      </div>
      <div className="book-card-content">
        <span className="category-chip">{book.category}</span>
        <h3>{book.title}</h3>
        {book.author && <p className="muted book-author">by {book.author}</p>}
        <strong className="book-price">{formatPrice(book.price)}</strong>
        <div className="book-trust-meta">
          {book.delivery_time === "WITHIN_1_HOUR" && <span>Meet in 1 Hour</span>}
          {Number(book.seller?.trust_score) > 0 && <span>★ {Number(book.seller.trust_score).toFixed(1)} Avg Rating</span>}
          {book.seller?.college_id_verified && <span className="verified-badge">Verified</span>}
        </div>
        <p className="muted small">{book.condition}</p>
        <p className="muted small">⌖ {book.city} · {book.college_name}</p>
      </div>
    </Link>
  );
}
