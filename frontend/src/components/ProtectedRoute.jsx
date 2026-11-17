import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Loader from "./Loader";
import { hasValidAdminToken } from "../utils/adminAuth";

export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loader />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}

export function AdminRoute({ children }) {
  if (!hasValidAdminToken()) return <Navigate to="/" replace />;
  return children;
}
