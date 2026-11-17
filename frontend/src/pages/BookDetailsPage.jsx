import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  createRating,
  createReport,
  getBookById,
  getMyOrders,
  getRatings,
  getReports,
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import { formatDate, formatPrice, getErrorMessage } from "../utils/helpers";
import Loader from "../components/Loader";
import ErrorMessage from "../components/ErrorMessage";
import StatusBadge from "../components/StatusBadge";
import BuyNowModal from "../components/BuyNowModal";

export default function BookDetailsPage() {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [buying, setBuying] = useState(false);
  const [notice, setNotice] = useState("");
  const [deliveredOrders, setDeliveredOrders] = useState([]);
  const [reports, setReports] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [reportReason, setReportReason] = useState("TOOK_MONEY_NO_BOOK");
  const [reportDescription, setReportDescription] = useState("");
  const [ratingOrder, setRatingOrder] = useState("");
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [formError, setFormError] = useState("");

  async function loadBuyerData(bookId, sellerId) {
    try {
      const { data: ratingsData } = await getRatings({ rated_user: sellerId });
      setRatings(ratingsData);
      if (!isAuthenticated) return;
      const [{ data: ordersData }, { data: reportsData }] = await Promise.all([
        getMyOrders({ as: "buyer" }), getReports(),
      ]);
      const delivered = ordersData.filter((order) => order.book_id === Number(bookId) && order.delivery_status === "DELIVERED");
      setDeliveredOrders(delivered);
      setReports(reportsData.filter((report) => report.book === Number(bookId)));
      setRatingOrder((current) => current || String(delivered[0]?.order_id || ""));
    } catch (requestError) {
      setFormError(getErrorMessage(requestError, "Could not load reports or ratings."));
    }
  }

  useEffect(() => {
    let active = true;
    getBookById(id).then(({ data }) => {
      if (active) setBook(data);
    }).catch((requestError) => {
      if (active) setError(requestError.response?.status === 404 ? "Book not found." : getErrorMessage(requestError, "Could not load this book."));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (book) loadBuyerData(book.book_id, book.seller_id);
  }, [book, isAuthenticated]);

  async function submitReport(event) {
    event.preventDefault();
    setFormError("");
    try {
      await createReport({
        reported_user_id: book.seller_id,
        book: book.book_id,
        reason: reportReason,
        description: reportDescription,
      });
      setReportDescription("");
      await loadBuyerData(book.book_id, book.seller_id);
    } catch (requestError) {
      setFormError(getErrorMessage(requestError, "Could not submit your report."));
    }
  }

  async function submitRating(event) {
    event.preventDefault();
    setFormError("");
    try {
      await createRating({ order_id: Number(ratingOrder), stars: Number(stars), comment });
      setComment("");
      await loadBuyerData(book.book_id, book.seller_id);
    } catch (requestError) {
      setFormError(getErrorMessage(requestError, "Could not submit your rating."));
    }
  }

  if (loading) return <main className="container page-space"><Loader /></main>;
  if (error || !book) return <main className="container page-space"><ErrorMessage message={error || "Book not found."} /><Link className="btn btn-primary" to="/">Explore books</Link></main>;
  const isOwner = user?.user_id === book.seller_id;
  const available = ["approved", "available"].includes(book.status);
  const askLogin = () => navigate("/login", { state: { from: location.pathname } });
  const sellerName = book.seller?.full_name || "BookLoop student";

  return (
    <main className="container page-space">
      <Link to="/" className="back-link">← Back to explore</Link>
      {notice && <div className="alert alert-success">{notice} <Link to="/my-orders">View your orders →</Link></div>}
      <article className="details-layout">
        <div className="details-image-wrap">
          <img src={book.image_url || "/placeholder-book.svg"} alt={book.title} onError={(event) => { event.currentTarget.src = "/placeholder-book.svg"; }} />
          <StatusBadge status={book.status} />
        </div>
        <div className="details-content">
          <span className="category-chip">{book.category}</span>
          <h1>{book.title}</h1>
          {book.author && <p className="muted details-author">by {book.author}</p>}
          <p className="details-price">{formatPrice(book.price)}</p>
          {book.is_urgent && <p className="book-trust-badge urgent-badge">URGENT - Available Today</p>}
          {book.delivery_time === "WITHIN_1_HOUR" && <p className="book-trust-badge">Meet in 1 Hour</p>}
          <p className="details-description">{book.description}</p>
          <div className="details-facts">
            <div><span>Subject</span><strong>{book.subject}</strong></div>
            <div><span>Condition</span><strong>{book.condition}</strong></div>
            <div><span>Department</span><strong>{book.department}</strong></div>
            <div><span>City</span><strong>{book.city}</strong></div>
            <div><span>College</span><strong>{book.college_name}</strong></div>
            <div><span>Posted</span><strong>{formatDate(book.created_at)}</strong></div>
            {book.seller?.trust_score > 0 && <div><span>Average seller rating</span><strong>★ {Number(book.seller.trust_score).toFixed(1)} / 5</strong></div>}
          </div>
          <section className="seller-card">
            <span className="seller-avatar">{sellerName.charAt(0).toUpperCase()}</span>
            <div><span className="muted small">Listed by</span><strong>{sellerName} {book.seller?.college_id_verified && <span className="verified-badge">Verified</span>}</strong><span className="muted small">{book.seller?.college_name || book.college_name} · {book.seller?.city || book.city}</span></div>
          </section>
          <div className="details-actions">
            {isOwner ? <><p className="alert alert-info">This is your listing.</p><Link className="btn btn-outline" to={`/sell/${book.book_id}/edit`}>Edit listing</Link></> : <>
              {available ? <button className="btn btn-primary" onClick={() => isAuthenticated ? setBuying(true) : askLogin()}>Buy now · {formatPrice(book.price)}</button> : <button className="btn btn-outline" disabled>{book.status === "sold" ? "This item has been sold" : "Not available"}</button>}
              <button className="btn btn-outline" disabled={!isAuthenticated} title={!isAuthenticated ? "Log in to chat with the seller" : ""} onClick={() => navigate(`/chat/${book.book_id}/${book.seller_id}`)}>Chat with seller</button>
              {!isAuthenticated && <button className="link-button" onClick={askLogin}>Log in to chat</button>}
            </>}
          </div>
          <p className="safety-note">For your safety, never share passwords in chat.</p>
          <aside className="safety-tip"><strong>Safety Tip</strong><p>Never pay in advance. Meet in a public place and check the book before paying. Report suspicious activity.</p></aside>
        </div>
      </article>
      {formError && <ErrorMessage message={formError} />}
      {reports.some((report) => report.status === "ACTION_TAKEN") && <p className="alert alert-success">Action Taken on your Report</p>}
      {isAuthenticated && deliveredOrders.length > 0 && !isOwner && <section className="post-delivery-actions">
        <form className="form-card" onSubmit={submitReport}>
          <h2>Report Seller</h2>
          <label className="field"><span>Reason</span><select value={reportReason} onChange={(event) => setReportReason(event.target.value)}><option value="TOOK_MONEY_NO_BOOK">Took money, no book</option><option value="FAKE_BOOK">Fake book</option><option value="WRONG_BOOK">Wrong book</option><option value="ABUSIVE_CHAT">Abusive chat</option></select></label>
          <label className="field"><span>Description</span><textarea rows="3" value={reportDescription} onChange={(event) => setReportDescription(event.target.value)} /></label>
          <button className="btn btn-outline">Submit Report</button>
        </form>
        {deliveredOrders.some((order) => !ratings.some((rating) => rating.order_id === order.order_id)) && <form className="form-card" onSubmit={submitRating}>
          <h2>Rate Seller</h2>
          <label className="field"><span>Delivered order</span><select value={ratingOrder} onChange={(event) => setRatingOrder(event.target.value)}>{deliveredOrders.filter((order) => !ratings.some((rating) => rating.order_id === order.order_id)).map((order) => <option key={order.order_id} value={order.order_id}>Order #{order.order_id}</option>)}</select></label>
          <label className="field"><span>Rating</span><select value={stars} onChange={(event) => setStars(event.target.value)}>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} star{value > 1 ? "s" : ""}</option>)}</select></label>
          <label className="field"><span>Review</span><textarea rows="3" value={comment} onChange={(event) => setComment(event.target.value)} /></label>
          <button className="btn btn-primary">Submit Rating</button>
        </form>}
      </section>}
      {ratings.length > 0 && <section className="seller-reviews"><h2>Seller Reviews</h2>{ratings.slice(0, 5).map((rating) => <article key={rating.id}><strong>{"★".repeat(rating.stars)}{"☆".repeat(5 - rating.stars)}</strong><p>{rating.comment || "No written review."}</p></article>)}</section>}
      {buying && <BuyNowModal book={book} onClose={() => setBuying(false)} onSuccess={() => { setBuying(false); setNotice("Order request sent! Chat with the seller to arrange delivery."); }} />}
    </main>
  );
}