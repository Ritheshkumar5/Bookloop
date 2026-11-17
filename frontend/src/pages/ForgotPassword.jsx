import { useState } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "../services/api";
import { getErrorMessage } from "../utils/helpers";
import ErrorMessage from "../components/ErrorMessage";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (requestError) {
      console.error(
        "Password reset request failed:",
        requestError.response?.data || requestError,
      );
      setError(getErrorMessage(requestError, "Could not request a password reset."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container narrow page-space">
      <section className="auth-panel">
        <span className="eyebrow">Account recovery</span>
        <h2>Forgot your password?</h2>
        <p className="muted">Enter the email address associated with your account.</p>
        {sent ? (
          <p className="alert alert-success" role="status">
            If an account exists, a reset link has been sent
          </p>
        ) : (
          <>
            {error && <ErrorMessage message={error} />}
            <form className="form-card auth-form" onSubmit={submit}>
              <label className="field">
                <span>Email *</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </label>
              <button className="btn btn-primary btn-wide" disabled={busy}>
                {busy ? "Please wait…" : "Send reset link"}
              </button>
            </form>
          </>
        )}
        <p className="auth-switch"><Link to="/login">Back to Login</Link></p>
      </section>
    </main>
  );
}
