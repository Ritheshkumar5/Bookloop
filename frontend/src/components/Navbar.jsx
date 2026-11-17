import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout();
    } finally {
      setOpen(false);
      navigate("/");
    }
  }

  const closeMenu = () => setOpen(false);
  return (
    <header className="site-header">
      <nav className="nav-shell container">
        <Link className="brand" to="/" onClick={closeMenu} aria-label="BookLoop home">
          <span className="brand-mark">B</span>
          <span>BookLoop<small>One Book, Many Readers!</small></span>
        </Link>
        <button className="menu-toggle" aria-label="Toggle navigation" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span /><span /><span />
        </button>
        <div className={`nav-links ${open ? "nav-links-open" : ""}`}>
          <NavLink to="/" onClick={closeMenu}>Explore</NavLink>
          {isAuthenticated ? (
            <>
              <NavLink to="/sell" onClick={closeMenu}>Sell a book</NavLink>
              <NavLink to="/my-listings" onClick={closeMenu}>My listings</NavLink>
              <NavLink to="/my-orders" onClick={closeMenu}>My orders</NavLink>
              <NavLink to="/chat" onClick={closeMenu}>Messages</NavLink>
              <span className="nav-user">Hi, {user?.full_name?.split(" ")[0]}</span>
              <button className="nav-logout" onClick={handleLogout}>Log out</button>
            </>
          ) : (
            <>
              <NavLink to="/login" onClick={closeMenu}>Log in</NavLink>
              <Link className="btn btn-primary nav-join" to="/register" onClick={closeMenu}>Join BookLoop</Link>
            </>
          )}

          
          <Link to="/admin-login" onClick={closeMenu} className="btn btn-outline admin-login-link">
            Admin Login
          </Link>

        </div>
      </nav>
    </header>
  );
}