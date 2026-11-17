const labels = {
  pending: "Pending review",
  approved: "Approved",
  available: "Available",
  rejected: "Rejected",
  sold: "Sold",
  requested: "Requested",
  accepted: "Accepted",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function StatusBadge({ status }) {
  return <span className={`status-badge status-${status}`}>{labels[status] || status}</span>;
}
