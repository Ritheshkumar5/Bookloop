import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyOrders, updateOrderStatus } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { formatDate, formatPrice, getErrorMessage } from "../utils/helpers";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import ErrorMessage from "../components/ErrorMessage";
import StatusBadge from "../components/StatusBadge";

const DELIVERY_STEPS = [
  ["CONFIRMED", "Confirmed"],
  ["DELIVERY_BOOKED", "Delivery booked"],
  ["RIDER_ARRIVED", "Rider arrived"],
  ["PAYMENT_RECEIVED", "Payment received"],
  ["PICKED_UP", "Picked up"],
  ["OUT_FOR_DELIVERY", "Out for delivery"],
  ["DELIVERED", "Delivered"],
];

export default function MyOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await getMyOrders();
      setOrders(data);
      setError("");
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Could not load your orders."));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function changeStatus(order, order_status) {
    setBusyId(order.order_id);
    setError("");
    try {
      const { data } = await updateOrderStatus(order.order_id, order_status);
      setOrders((previous) => previous.map((item) => item.order_id === data.order_id ? data : item));
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Order status could not be updated."));
    } finally { setBusyId(null); }
  }

  async function changeDelivery(order, delivery_status) {
    setBusyId(order.order_id);
    setError("");
    try {
      const { data } = await updateOrderStatus(order.order_id, { delivery_status });
      setOrders((previous) => previous.map((item) => item.order_id === data.order_id ? data : item));
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Delivery status could not be updated."));
    } finally { setBusyId(null); }
  }

  async function confirmPayment(order) {
    setBusyId(order.order_id);
    setError("");
    try {
      const { data } = await updateOrderStatus(order.order_id, {
        payment_before_pickup_status: "RECEIVED",
      });
      setOrders((previous) => previous.map((item) => item.order_id === data.order_id ? data : item));
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Payment could not be confirmed."));
    } finally { setBusyId(null); }
  }

  if (loading) return <main className="container page-space"><Loader /></main>;
  return (
    <main className="container page-space">
      <div className="page-heading"><span className="eyebrow">Keep track</span><h1>My orders</h1><p className="muted">Order requests as a buyer and updates for your listings.</p></div>
      {error && <ErrorMessage message={error} onRetry={load} />}
      {!orders.length && !error ? <EmptyState title="No orders yet" message="When you request a book or a buyer requests yours, it will show up here." actionLabel="Explore books" onAction={() => { window.location.href = "/"; }} /> : (
        <div className="order-list">
          {orders.map((order) => {
            const seller = user.user_id === order.seller_id;
            const canCancel = ["requested", "accepted"].includes(order.order_status);
            const stepIndex = DELIVERY_STEPS.findIndex(([value]) => value === order.delivery_status);
            const expectedDate = new Date(new Date(order.order_date).getTime() + 4 * 24 * 60 * 60 * 1000);
            return <article className="order-card" key={order.order_id}>
              <img src={order.book_image_url || "/placeholder-book.svg"} alt="" />
              <div className="order-info">
                <span className="eyebrow">Order #{order.order_id} · {seller ? "Seller" : "Buyer"}</span>
                <h2>{order.book_title}</h2>
                <p className="muted">{seller ? `Requested by ${order.buyer_name}` : `Seller: ${order.seller_name}`}</p>
                <p className="muted">{order.delivery_method === "courier" ? "Courier delivery" : "Meet in person"} · {formatDate(order.order_date)}</p>
                {order.delivery_address && <p className="small">{order.delivery_address}</p>}
                <div className="tracking-details">
                  <p><strong>Payment:</strong> {order.payment_status} ({order.payment_method})</p>
                  <p><strong>Expected by:</strong> {formatDate(expectedDate)}</p>
                </div>
                <ol className="tracking-timeline" aria-label="Delivery tracking">
                  {DELIVERY_STEPS.map(([value, label], index) => <li key={value} className={index <= stepIndex ? "tracking-step complete" : "tracking-step"}><span>{label}</span></li>)}
                </ol>
                {order.delivery_status === "CANCELLED" && <p className="alert alert-error">Delivery cancelled.</p>}
                {order.delivery_status === "RIDER_ARRIVED" && seller && <div className="alert alert-danger"><strong>STOP! Do not hand over book yet. Collect payment from Buyer first.</strong><p><a href={`tel:${order.buyer_phone}`}>Call Buyer</a></p><button className="btn btn-small btn-primary" disabled={busyId === order.order_id} onClick={() => confirmPayment(order)}>I Received Payment</button></div>}
                {order.delivery_status === "RIDER_ARRIVED" && !seller && <div className="alert alert-warning"><strong>Rider reached Seller. Pay Seller now via UPI/Cash, else Seller will not hand over.</strong><p>Seller phone: <a href={`tel:${order.seller_phone}`}>{order.seller_phone || "Not provided"}</a></p></div>}
              </div>
              <div className="order-aside"><strong className="book-price">{formatPrice(order.agreed_price)}</strong><StatusBadge status={order.order_status} /></div>
              <div className="order-actions">
                {seller && order.order_status === "requested" && <button className="btn btn-small btn-primary" disabled={busyId === order.order_id} onClick={() => changeStatus(order, "accepted")}>Accept request</button>}
                {seller && order.order_status === "accepted" && <button className="btn btn-small btn-primary" disabled={busyId === order.order_id} onClick={() => changeStatus(order, "completed")}>Mark completed</button>}
                {seller && order.order_status === "accepted" && <>
                  <label className="delivery-status-select"><span>Delivery status</span><select value={order.delivery_status} disabled={busyId === order.order_id} onChange={(event) => changeDelivery(order, event.target.value)}>{DELIVERY_STEPS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}<option value="CANCELLED">Cancelled</option></select></label>
                  <button className="btn btn-small btn-outline" disabled={busyId === order.order_id} onClick={() => changeDelivery(order, "RIDER_ARRIVED")}>Rider Arrived</button>
                  {order.payment_before_pickup_status !== "RECEIVED" && <button className="btn btn-small btn-primary" disabled={busyId === order.order_id} onClick={() => confirmPayment(order)}>I Received Payment</button>}
                </>}
                {!seller && order.order_status === "requested" && <button className="btn btn-small btn-outline" disabled={busyId === order.order_id} onClick={() => changeStatus(order, "cancelled")}>Cancel request</button>}
                {seller && canCancel && <button className="btn btn-small btn-danger-outline" disabled={busyId === order.order_id} onClick={() => changeStatus(order, "cancelled")}>Cancel</button>}
                <Link className="btn btn-small btn-outline" to={`/books/${order.book_id}`}>View book</Link>
                <Link className="btn btn-small btn-outline" to={`/chat/${order.book_id}/${seller ? order.buyer_id : order.seller_id}`}>Chat</Link>
              </div>
            </article>;
          })}
        </div>
      )}
    </main>
  );
}