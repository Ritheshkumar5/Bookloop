import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage, getFieldErrors } from "../utils/helpers";
import { validateRegistration } from "../utils/validators";
import ErrorMessage from "../components/ErrorMessage";

const EMPTY_REGISTER = {
  full_name: "", email: "", password: "", confirm_password: "", phone: "",
  city: "", college_name: "", department: "", role: "buyer",
};

export default function AuthPage({ mode = "login" }) {
  const isRegister = mode === "register";
  const { isAuthenticated, login, register } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [values, setValues] = useState(EMPTY_REGISTER);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const set = (key) => (event) => setValues((previous) => ({ ...previous, [key]: event.target.value }));
  async function submit(event) {
    event.preventDefault();
    setError("");
    setFieldErrors({});
    if (isRegister) {
      const validation = validateRegistration(values);
      setFieldErrors(validation);
      if (Object.keys(validation).length) return;
    }
    setBusy(true);
    try {
      if (isRegister) {
        const { confirm_password, ...payload } = values;
        await register(payload);
        navigate("/login", { replace: true, state: { message: "Account created. You can now log in." } });
      } else {
        await login(values.email, values.password);
        const requestedPath = location.state?.from || new URLSearchParams(location.search).get("from");
        const from = requestedPath?.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/";
        navigate(from, { replace: true });
      }
    } catch (requestError) {
      setFieldErrors(getFieldErrors(requestError));
      setError(getErrorMessage(requestError, isRegister ? "Could not create your account." : "Invalid email or password."));
    } finally { setBusy(false); }
  }

  const field = (key, label, type = "text", required = true, autocomplete) => (
    <label className={`field ${fieldErrors[key] ? "has-error" : ""}`} key={key}>
      <span>{label}{required && <i> *</i>}</span>
      <input type={type} value={values[key] || ""} onChange={set(key)} required={required} autoComplete={autocomplete} />
      {fieldErrors[key] && <small className="field-error">{fieldErrors[key]}</small>}
    </label>
  );

  return (
    <main className="container auth-layout page-space">
      <section className="auth-aside">
        <span className="eyebrow">Good things deserve another chapter</span>
        <h1>Pass it on.<br /><em>Pay less.</em></h1>
        <p>BookLoop connects students across India to affordable study materials and the people who have used them.</p>
        <div className="auth-aside-mark">B</div>
      </section>
      <section className="auth-panel">
        <span className="eyebrow">{isRegister ? "Join the community" : "Welcome back"}</span>
        <h2>{isRegister ? "Create your account" : "Log in to BookLoop"}</h2>
        <p className="muted">{isRegister ? "Your next great find starts here." : "Pick up where you left off."}</p>
        {!isRegister && location.state?.message && <p className="alert alert-success">{location.state.message}</p>}
        {!isRegister && new URLSearchParams(location.search).has("expired") && <p className="alert alert-info">Your session expired. Please log in again.</p>}
        {error && <ErrorMessage message={error} />}
        <form className="form-card auth-form" onSubmit={submit} noValidate>
          {isRegister ? <>
            <div className="form-grid">
              {field("full_name", "Full name", "text", true, "name")}
              {field("email", "Email", "email", true, "email")}
              {field("password", "Password", "password", true, "new-password")}
              {field("confirm_password", "Confirm password", "password", true, "new-password")}
              {field("phone", "Phone (optional)", "tel", false, "tel")}
              {field("city", "City", "text", true, "address-level2")}
              {field("college_name", "College / university", "text", true, "organization")}
              {field("department", "Department", "text", true, "organization-title")}
              <label className={`field ${fieldErrors.role ? "has-error" : ""}`}><span>I want to… *</span><select value={values.role} onChange={set("role")}><option value="buyer">Find study materials</option><option value="seller">Sell study materials</option></select>{fieldErrors.role && <small className="field-error">{fieldErrors.role}</small>}</label>
            </div>
            <p className="muted small">All students can both buy and sell, whatever role you choose.</p>
          </> : <>{field("email", "Email", "email", true, "email")}{field("password", "Password", "password", true, "current-password")}<Link className="auth-forgot-link" to="/forgot-password">Forgot Password?</Link></>}
          <button className="btn btn-primary btn-wide" disabled={busy}>{busy ? "Please wait…" : isRegister ? "Create account" : "Log in"}</button>
        </form>
        <p className="auth-switch">{isRegister ? "Already have an account?" : "New to BookLoop?"} <Link to={isRegister ? "/login" : "/register"}>{isRegister ? "Log in" : "Create an account"}</Link></p>
      </section>
    </main>
  );
}
