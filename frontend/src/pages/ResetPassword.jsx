import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  completePasswordReset,
  preparePasswordReset,
} from "../services/api";
import { getErrorMessage } from "../utils/helpers";
import ErrorMessage from "../components/ErrorMessage";

export default function ResetPassword() {
  const { uidb64, token } = useParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    let active = true;
    preparePasswordReset(uidb64, token)
      .then(() => {
        if (active) setReady(true);
      })
      .catch((requestError) => {
        if (active) setError(getErrorMessage(requestError, "This reset link is invalid or has expired."));
      });
    return () => { active = false; };
  }, [uidb64, token]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await completePasswordReset(uidb64, {
        token,
        new_password1: password,
        new_password2: confirmPassword,
      });
      setComplete(true);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Could not reset your password."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container narrow page-space">
      <section className="auth-panel">
        <span className="eyebrow">Account recovery</span>
        <h2>Reset your password</h2>
        {complete ? (
          <>
            <p className="alert alert-success" role="status">Your password has been reset successfully.</p>
            <p className="auth-switch"><Link to="/login">Back to Login</Link></p>
          </>
        ) : (
          <>
            {error && <ErrorMessage message={error} />}
            {ready && (
              <form className="form-card auth-form" onSubmit={submit}>
                <label className="field">
                  <span>New password *</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </label>
                <label className="field">
                  <span>Confirm password *</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </label>
                <button className="btn btn-primary btn-wide" disabled={busy}>
                  {busy ? "Please wait…" : "Set new password"}
                </button>
              </form>
            )}
          </>
        )}
      </section>
    </main>
  );
}
