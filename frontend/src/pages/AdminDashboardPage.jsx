import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  approveAdminBook, deleteAdminBook, deleteAdminUser, getAdminBooks,
  getAdminOrders, getAdminReports, getAdminUsers, rejectAdminBook,
  updateAdminReport, updateAdminUser,
} from "../services/api";
import { formatDate, formatPrice, getErrorMessage } from "../utils/helpers";
import { clearAdminToken } from "../utils/adminAuth";
import Loader from "../components/Loader";
import ErrorMessage from "../components/ErrorMessage";
import StatusBadge from "../components/StatusBadge";
import ConfirmDialog from "../components/ConfirmDialog";

const tabs = ["Listings", "Users", "Orders", "Reports"];

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("Listings");
  const [status, setStatus] = useState("pending");
  const [books, setBooks] = useState([]);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (tab === "Listings") {
        const { data } = await getAdminBooks(status ? { status } : {});
        setBooks(Array.isArray(data) ? data : data.results);
      } else if (tab === "Users") {
        const [{ data }, { data: reportData }] = await Promise.all([getAdminUsers(), getAdminReports()]);
        setUsers(Array.isArray(data) ? data : data.results);
        setReports(reportData);
      } else if (tab === "Orders") {
        const { data } = await getAdminOrders();
        setOrders(Array.isArray(data) ? data : data.results);
      } else {
        const [{ data }, { data: userData }] = await Promise.all([getAdminReports(), getAdminUsers()]);
        setReports(data);
        setUsers(Array.isArray(userData) ? userData : userData.results);
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError, `Could not load ${tab.toLowerCase()}.`));
    } finally { setLoading(false); }
  }, [tab, status]);

  useEffect(() => { load(); }, [load]);

  async function moderate(book, nextStatus, blockUser = false, warningMessage = "") {
    setBusyId(book.book_id);
    setError("");
    try {
      if (nextStatus === "delete") {
        await deleteAdminBook(book.book_id, {
          block_user: blockUser,
          warning_message: warningMessage,
        });
        setBooks((previous) => previous.filter((item) => item.book_id !== book.book_id));
      } else if (nextStatus === "approved") {
        const { data } = await approveAdminBook(book.book_id);
        setBooks((previous) => status === "pending"
          ? previous.filter((item) => item.book_id !== data.book_id)
          : previous.map((item) => item.book_id === data.book_id ? data : item));
      } else {
        const { data } = await rejectAdminBook(book.book_id, confirm?.reason?.trim());
        setBooks((previous) => status === "pending"
          ? previous.filter((item) => item.book_id !== data.book_id)
          : previous.map((item) => item.book_id === data.book_id ? data : item));
      }
      setConfirm(null);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Could not moderate this listing."));
      setConfirm(null);
    } finally { setBusyId(null); }
  }

  async function toggleUser(target) {
    setBusyId(target.user_id);
    try {
      const { data } = await updateAdminUser(
        target.user_id,
        target.is_blocked
          ? { is_blocked: false, is_active: true }
          : { is_active: !target.is_active }
      );
      setUsers((previous) => previous.map((item) => item.user_id === data.user_id ? data : item));
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Could not update this account."));
    } finally { setBusyId(null); }
  }

  async function verifyUser(target, field) {
    setBusyId(target.user_id);
    setError("");
    try {
      const { data } = await updateAdminUser(target.user_id, { [field]: !target[field] });
      setUsers((previous) => previous.map((item) => item.user_id === data.user_id ? data : item));
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Could not update seller verification."));
    } finally { setBusyId(null); }
  }

  async function moderateReport(report, action) {
    const warning = action === "warn" || action === "block"
      ? window.prompt("Enter the warning reason for this seller:") : "";
    if ((action === "warn" || action === "block") && !warning?.trim()) return;
    setBusyId(report.id);
    setError("");
    try {
      const { data } = await updateAdminReport(report.id, {
        action,
        ...(warning ? { warning_message: warning.trim() } : {}),
      });
      setReports((previous) => previous.map((item) => item.id === data.id ? data : item));
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Could not update this report."));
    } finally { setBusyId(null); }
  }

  async function removeUser(target) {
    if (!window.confirm(`Permanently delete ${target.full_name}'s account? This cannot be undone.`)) return;
    setBusyId(target.user_id);
    setError("");
    try {
      await deleteAdminUser(target.user_id);
      setUsers((previous) => previous.filter((person) => person.user_id !== target.user_id));
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Could not delete this account."));
    } finally { setBusyId(null); }
  }

  function logoutAdmin() {
    clearAdminToken();
    navigate("/admin-login", { replace: true });
  }

  if (loading) return <main className="container page-space"><Loader text="Loading dashboard…" /></main>;
  return (
    <main className="container page-space admin-page">
      <div className="page-heading"><span className="eyebrow">Platform management</span><h1>Admin dashboard</h1><p className="muted">Review listings and help keep the BookLoop community useful.</p><button className="btn btn-outline" onClick={logoutAdmin}>Log out</button></div>
      <div className="admin-tabs" role="tablist">{tabs.map((item) => <button key={item} role="tab" aria-selected={tab === item} className={tab === item ? "admin-tab active" : "admin-tab"} onClick={() => setTab(item)}>{item}</button>)}</div>
      {error && <ErrorMessage message={error} onRetry={load} />}
      {tab === "Listings" && <section>
        <div className="admin-toolbar"><h2>{status === "pending" ? "Pending books for approval" : "All books"}</h2><label className="sort-control"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{["pending", "approved", "available", "rejected", "sold"].map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Listing</th><th>Seller / campus</th><th>Category</th><th>Price</th><th>Status</th><th>Posted</th><th>Actions</th></tr></thead><tbody>
          {!books.length ? <tr><td colSpan="7" className="table-empty">No listings match this status.</td></tr> : books.map((book) => <tr key={book.book_id}>
            <td><a className="table-book" href={`/books/${book.book_id}`}><img src={book.image_url || "/placeholder-book.svg"} alt="" /><span>{book.title}</span></a></td>
            <td>{book.seller?.full_name || `User ${book.seller_id}`}<small>{book.college_name} · {book.city}</small></td>
            <td>{book.category}</td><td>{formatPrice(book.price)}</td><td><StatusBadge status={book.status} /></td><td>{formatDate(book.created_at)}</td>
            <td><div className="table-actions">{book.status === "pending" && <><button className="btn btn-small btn-primary" disabled={busyId === book.book_id} onClick={() => moderate(book, "approved")}>Approve</button><button className="btn btn-small btn-outline" disabled={busyId === book.book_id} onClick={() => setConfirm({ book, action: "reject", reason: "" })}>Reject</button></>}<button className="btn btn-small btn-danger-outline" disabled={busyId === book.book_id} onClick={() => setConfirm({ book, action: "delete", blockUser: false, warningMessage: "" })}>Remove</button></div></td>
          </tr>)}
        </tbody></table></div>
      </section>}
      {tab === "Users" && <section><h2 className="admin-section-title">User accounts <span className="muted small">{users.length} accounts</span></h2><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>College / city</th><th>Trust</th><th>Verification</th><th>Status</th><th>Joined</th><th>Action</th></tr></thead><tbody>
        {!users.length ? <tr><td colSpan="9" className="table-empty">No user accounts found.</td></tr> : users.map((person) => {
          const reportCount = reports.filter((report) => report.reported_user_id === person.user_id).length;
          const lowTrust = (person.trust_score > 0 && person.trust_score < 2) || reportCount >= 3;
          return <tr key={person.user_id}><td>{person.full_name}{lowTrust && <small className="blocked-warning">Low Trust Seller</small>}</td><td>{person.email}</td><td>{person.role}</td><td>{person.college_name}<small>{person.city}</small></td><td>{Number(person.trust_score).toFixed(1)} / 5 · {reportCount} reports</td><td><button className="btn btn-small btn-outline" disabled={busyId === person.user_id} onClick={() => verifyUser(person, "phone_verified")}>{person.phone_verified ? "Phone verified" : "Verify phone"}</button><button className="btn btn-small btn-outline" disabled={busyId === person.user_id} onClick={() => verifyUser(person, "college_id_verified")}>{person.college_id_verified ? "ID verified" : "Verify college ID"}</button></td><td><span className={`status-badge ${person.is_blocked || !person.is_active ? "status-rejected" : "status-available"}`}>{person.is_blocked ? "Blocked" : person.is_active ? "Active" : "Suspended"}</span>{person.warning_message && <small className="blocked-warning">{person.warning_message}</small>}</td><td>{formatDate(person.created_at)}</td><td><div className="table-actions"><button className={`btn btn-small ${person.is_active ? "btn-danger-outline" : "btn-outline"}`} disabled={busyId === person.user_id} onClick={() => toggleUser(person)}>{person.is_blocked ? "Unblock" : person.is_active ? "Suspend" : "Activate"}</button><button className="btn btn-small btn-danger-outline" disabled={busyId === person.user_id} onClick={() => removeUser(person)}>Delete</button></div></td></tr>;
        })}
      </tbody></table></div></section>}
      {tab === "Orders" && <section><h2 className="admin-section-title">Orders <span className="muted small">{orders.length} records</span></h2><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Book</th><th>Buyer</th><th>Seller</th><th>Agreed price</th><th>Delivery</th><th>Status</th><th>Date</th></tr></thead><tbody>
        {!orders.length ? <tr><td colSpan="8" className="table-empty">No orders found.</td></tr> : orders.map((order) => <tr key={order.order_id}><td>#{order.order_id}</td><td>{order.book_title}</td><td>{order.buyer_name}</td><td>{order.seller_name}</td><td>{formatPrice(order.agreed_price)}</td><td>{order.delivery_method}</td><td><StatusBadge status={order.order_status} /></td><td>{formatDate(order.order_date)}</td></tr>)}
      </tbody></table></div></section>}
      {tab === "Reports" && <section><h2 className="admin-section-title">User reports <span className="muted small">{reports.length} reports</span></h2><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Reporter</th><th>Reported seller</th><th>Book</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {!reports.length ? <tr><td colSpan="6" className="table-empty">No reports submitted.</td></tr> : reports.map((report) => {
          const seller = users.find((person) => person.user_id === report.reported_user_id);
          const count = reports.filter((item) => item.reported_user_id === report.reported_user_id).length;
          const lowTrust = (seller?.trust_score > 0 && seller.trust_score < 2) || count >= 3;
          return <tr key={report.id}><td>{report.reporter_name}</td><td>{report.reported_user_name}{lowTrust && <small className="blocked-warning">Low Trust Seller</small>}</td><td>{report.book_title || "Listing removed"}</td><td>{report.reason}<small>{report.description}</small></td><td>{report.status}</td><td><div className="table-actions">{report.status === "PENDING" && <button className="btn btn-small btn-outline" disabled={busyId === report.id} onClick={() => moderateReport(report, "reviewed")}>Mark REVIEWED</button>}<button className="btn btn-small btn-outline" disabled={busyId === report.id} onClick={() => moderateReport(report, "warn")}>Warn Seller</button><button className="btn btn-small btn-danger-outline" disabled={busyId === report.id} onClick={() => moderateReport(report, "block")}>Block Seller</button><button className="btn btn-small btn-danger-outline" disabled={busyId === report.id} onClick={() => moderateReport(report, "delete_book")}>Delete Book</button></div></td></tr>;
        })}
      </tbody></table></div></section>}
      {confirm && <ConfirmDialog
        title={confirm.action === "reject" ? "Reject this listing?" : "Delete this listing?"}
        message={confirm.action === "reject"
          ? "Tell the seller what to fix before resubmitting."
          : `Delete “${confirm.book.title}” from BookLoop? Should this also block the seller?`}
        busy={busyId === confirm.book.book_id}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm.action === "reject" && !confirm.reason.trim()) {
            setError("Enter a rejection reason for the seller.");
            return;
          }
          if (confirm.action === "delete" && confirm.blockUser && !confirm.warningMessage.trim()) {
            setError("Enter a warning reason before blocking this seller.");
            return;
          }
          moderate(
            confirm.book,
            confirm.action === "reject" ? "rejected" : "delete",
            confirm.blockUser,
            confirm.warningMessage
          );
        }}
      >
        {confirm.action === "reject" ? (
          <label className="field moderation-field">
            <span>Rejection reason</span>
            <textarea rows="3" value={confirm.reason} onChange={(event) => setConfirm({ ...confirm, reason: event.target.value })} />
          </label>
        ) : (
          <div className="field moderation-field">
            <label><input type="radio" name="block-seller" checked={confirm.blockUser} onChange={() => setConfirm({ ...confirm, blockUser: true })} /> Yes, delete this book and block this user</label>
            <label><input type="radio" name="block-seller" checked={!confirm.blockUser} onChange={() => setConfirm({ ...confirm, blockUser: false })} /> No, delete this book only</label>
            {confirm.blockUser && <label className="field">
              <span>Warning reason</span>
              <textarea rows="3" value={confirm.warningMessage} onChange={(event) => setConfirm({ ...confirm, warningMessage: event.target.value })} />
            </label>}
          </div>
        )}
      </ConfirmDialog>}
    </main>
  );
}
