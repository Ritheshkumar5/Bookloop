import { useState } from "react";
import { createOrder } from "../services/api";
import { DELIVERY_METHODS } from "../utils/constants";
import { formatPrice, getErrorMessage } from "../utils/helpers";
import ErrorMessage from "./ErrorMessage";

export default function BuyNowModal({ book, onClose, onSuccess }) {
  const [method, setMethod] = useState(book.delivery_method || "meet");
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [urgent, setUrgent] = useState(Boolean(book.is_urgent));
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await createOrder({
        book_id: book.book_id,
        delivery_method: method,
        delivery_address: method === "courier" ? address : "",
        payment_method: paymentMethod,
        is_urgent: urgent,
      });
      onSuccess();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Could not place your order request."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <form className="modal-card" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="buy-title" style={{ maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <span className="eyebrow">Order request</span>
        <h2 id="buy-title">Request this book</h2>
        <p className="muted">{book.title} · <strong>{formatPrice(book.price)}</strong></p>
        <fieldset className="field delivery-field">
          <legend>How would you like to receive it?</legend>
          {DELIVERY_METHODS.map((item) => <label className="radio-option" key={item.value}><input type="radio" name="delivery" checked={method === item.value} onChange={() => { setMethod(item.value); if (item.value === "courier") setPaymentMethod("COD"); }} />{item.label}</label>)}
        </fieldset>
        <fieldset className="field delivery-field">
          <legend>Payment (no online payment)</legend>
          <label className="radio-option"><input type="radio" name="payment" checked={paymentMethod === "COD"} onChange={() => setPaymentMethod("COD")} />Cash on delivery (Recommended) — Pay only after you get book</label>
          <label className="radio-option"><input type="radio" name="payment" checked={paymentMethod === "MEETUP"} disabled={method === "courier"} onChange={() => setPaymentMethod("MEETUP")} />Pay on Meetup — Meet seller and pay</label>
        </fieldset>
        {method === "courier" && <label className="field"><span>Delivery address *</span><textarea rows="3" value={address} onChange={(event) => setAddress(event.target.value)} required /></label>}
        {method === "courier" && <p className="alert alert-info">Buyer will book Rapido / Porter. Pay book amount to seller on pickup. Pay delivery partner on delivery.</p>}
        <label className="radio-option"><input type="checkbox" checked={urgent} onChange={(event) => setUrgent(event.target.checked)} />Available urgently</label>
        <section className="order-summary">
          <h3>Order Summary</h3>
          <p>Book price <strong>{formatPrice(book.price)}</strong></p>
          <p className="order-summary-total">Total <strong>{formatPrice(book.price)}</strong></p>
        </section>
        <p className="alert alert-info">Never pay in advance. Pay only after delivery.</p>
        {error && <ErrorMessage message={error} />}
        <div className="button-row" style={{ position: 'sticky', bottom: 0, background: 'white', padding: '12px 0', marginTop: '12px' }}>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" disabled={busy || (method === "courier" && !address.trim())}>{busy ? "Sending…" : "Send order request"}</button>
        </div>
      </form>
    </div>
  );
}