import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { deleteBook, getBooks, markBookSold } from "../services/api";
import { formatDate, formatPrice, getErrorMessage } from "../utils/helpers";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import ErrorMessage from "../components/ErrorMessage";
import StatusBadge from "../components/StatusBadge";
import ConfirmDialog from "../components/ConfirmDialog";

export default function MyListingsPage() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(useLocation().state?.message || "");

  const load = useCallback(async () => {
    setError("");
    try {
      const { data } = await getBooks({ seller: "me", page_size: 50 });
      setBooks(Array.isArray(data) ? data : data.results);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Could not load your listings."));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function performAction() {
    setBusy(true);
    try {
      if (confirm.action === "delete") {
        await deleteBook(confirm.book.book_id);
        setBooks((previous) => previous.filter((book) => book.book_id !== confirm.book.book_id));
        setNotice("Listing deleted.");
      } else {
        const { data } = await markBookSold(confirm.book.book_id);
        setBooks((previous) => previous.map((book) => book.book_id === data.book_id ? data : book));
        setNotice("Listing marked as sold.");
      }
      setConfirm(null);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "The listing could not be updated."));
      setConfirm(null);
    } finally { setBusy(false); }
  }

  if (loading) return <main className="container page-space"><Loader /></main>;
  return (
    <main className="container page-space">
      <div className="page-heading row-heading"><div><span className="eyebrow">Your shelf</span><h1>My listings</h1><p className="muted">Manage items you have shared with the community.</p></div><Link className="btn btn-primary" to="/sell">＋ Sell a book</Link></div>
      {notice && <p className="alert alert-success">{notice}</p>}
      {error && <ErrorMessage message={error} onRetry={load} />}
      {!books.length && !error ? <EmptyState title="You haven't listed any books yet" message="Add your first study material listing to get started." actionLabel="Sell a book" onAction={() => { window.location.href = "/sell"; }} /> : (
        <div className="listing-list">
          {books.map((book) => <article className="listing-row" key={book.book_id}>
            <img src={book.image_url || "/placeholder-book.svg"} alt="" />
            <div className="listing-main"><span className="category-chip">{book.category}</span><h2><Link to={`/books/${book.book_id}`}>{book.title}</Link></h2><p className="muted">{book.college_name} · {book.city} · Posted {formatDate(book.created_at)}</p>{book.status === "rejected" && <p className="rejection-message">Rejected: {book.rejection_reason || "Please edit your listing and resubmit it."}</p>}</div>
            <strong className="book-price">{formatPrice(book.price)}</strong>
            <StatusBadge status={book.status} />
            <div className="listing-actions">
              <Link className="btn btn-small btn-outline" to={`/sell/${book.book_id}/edit`}>{book.status === "rejected" ? "Edit & Resubmit" : "Edit"}</Link>
              {["approved", "available"].includes(book.status) && <button className="btn btn-small btn-outline" onClick={() => setConfirm({ action: "sold", book })}>Mark sold</button>}
              <button className="btn btn-small btn-danger-outline" onClick={() => setConfirm({ action: "delete", book })}>Delete</button>
            </div>
          </article>)}
        </div>
      )}
      {confirm && <ConfirmDialog title={confirm.action === "delete" ? "Delete this listing?" : "Mark this book as sold?"} message={confirm.action === "delete" ? "This cannot be undone. Listings with order history cannot be deleted." : "This item will no longer be available for new order requests."} busy={busy} onCancel={() => setConfirm(null)} onConfirm={performAction} />}
    </main>
  );
}
