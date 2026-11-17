export default function ConfirmDialog({ title, message, children, onConfirm, onCancel, busy = false }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onCancel();
    }}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <h2 id="confirm-title">{title}</h2>
        <p>{message}</p>
        {children}
        <div className="button-row">
          <button className="btn btn-outline" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={busy}>{busy ? "Please wait…" : "Confirm"}</button>
        </div>
      </section>
    </div>
  );
}
