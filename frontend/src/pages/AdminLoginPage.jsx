import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import ErrorMessage from "../components/ErrorMessage";
import { loginAdmin } from "../services/api";
import { ADMIN_TOKEN_KEY } from "../utils/constants";
import { getErrorMessage } from "../utils/helpers";
import { hasValidAdminToken } from "../utils/adminAuth";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (hasValidAdminToken()) return <Navigate to="/admin-dashboard" replace />;

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { data } = await loginAdmin({ username: username.trim(), password });
      if (!data.is_admin || !data.access) throw new Error("The server did not return an admin session.");
      localStorage.setItem(ADMIN_TOKEN_KEY, data.access);
      navigate("/admin-dashboard", { replace: true });
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Could not log in as admin."));
    } finally {
      setPassword("");
      setBusy(false);
    }
  }

  return (
    <main className="container auth-layout page-space">
      <section className="auth-aside">
        <span className="eyebrow">BookLoop administration</span>
        <h1>Keep the<br /><em>community</em> moving.</h1>
        <p>Review listings, manage accounts and orders, and respond to reports.</p>
        <div className="auth-aside-mark">B</div>
      </section>
      <section className="auth-panel">
        <span className="eyebrow">Admin access</span>
        <h2>Admin login</h2>
        <p className="muted">Use your configured administrator credentials.</p>
        {error && <ErrorMessage message={error} />}
        <form className="form-card auth-form" onSubmit={submit}>
          <label className="field">
            <span>Email or username *</span>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="field">
            <span>Password *</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button className="btn btn-primary btn-wide" disabled={busy}>
            {busy ? "Please wait…" : "Log in"}
          </button>
        </form>
        <p className="auth-switch"><Link to="/">Return to BookLoop</Link></p>
      </section>
    </main>
  );
}
