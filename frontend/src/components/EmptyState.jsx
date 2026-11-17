export default function EmptyState({ title, message, actionLabel, onAction }) {
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden="true">⌕</span>
      <h2>{title}</h2>
      {message && <p className="muted">{message}</p>}
      {actionLabel && onAction && <button className="btn btn-primary" onClick={onAction}>{actionLabel}</button>}
    </div>
  );
}
