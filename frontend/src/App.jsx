import { Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { AdminRoute, ProtectedRoute } from "./components/ProtectedRoute";
import HomePage from "./pages/HomePage";
import BookDetailsPage from "./pages/BookDetailsPage";
import AuthPage from "./pages/AuthPage";
import SellBookPage from "./pages/SellBookPage";
import MyListingsPage from "./pages/MyListingsPage";
import MyOrdersPage from "./pages/MyOrdersPage";
import ChatPage from "./pages/ChatPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

export default function App() {
  return <>
    <Navbar />
    <div className="app-content">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/books/:id" element={<BookDetailsPage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:uidb64/:token/" element={<ResetPassword />} />
        <Route path="/sell" element={<ProtectedRoute><SellBookPage /></ProtectedRoute>} />
        <Route path="/sell/:id/edit" element={<ProtectedRoute><SellBookPage /></ProtectedRoute>} />
        <Route path="/my-listings" element={<ProtectedRoute><MyListingsPage /></ProtectedRoute>} />
        <Route path="/my-orders" element={<ProtectedRoute><MyOrdersPage /></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
        <Route path="/chat/:bookId/:otherUserId" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
        <Route path="/admin-login" element={<AdminLoginPage />} />
        <Route path="/admin-dashboard" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
        <Route path="/admin" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
    <Footer />
  </>;
}
