import axios from "axios";
import { ADMIN_TOKEN_KEY, REFRESH_KEY, TOKEN_KEY, USER_KEY } from "../utils/constants";

const baseURL = import.meta.env.NEXT_PUBLIC_API_URL || import.meta.env.VITE_API_URL;
if (!baseURL) {
  throw new Error("Set NEXT_PUBLIC_API_URL to the BookLoop API base URL.");
}
const api = axios.create({
  baseURL,
  timeout: 15000,
});
const adminApi = axios.create({ baseURL, timeout: 15000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes("/users/login/")) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem(USER_KEY);
      if (window.location.pathname !== "/login") {
        window.location.assign(`/login?expired=1&from=${encodeURIComponent(window.location.pathname)}`);
      }
    }
    return Promise.reject(error);
  }
);

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      if (window.location.pathname !== "/admin-login") {
        window.location.assign("/admin-login");
      }
    }
    return Promise.reject(error);
  }
);

export const registerUser = (data) => api.post("/api/users/register/", data);
export const loginUser = (data) => api.post("/api/users/login/", data);
export const logoutUser = (refresh) => api.post("/api/users/logout/", { refresh });
export const requestPasswordReset = (email) =>
  api.post("/api/password-reset/", { email });
export const preparePasswordReset = (uidb64, token) =>
  api.get(
    `/api/password-reset/${encodeURIComponent(uidb64)}/${encodeURIComponent(token)}/`,
  );
export const completePasswordReset = (uidb64, passwords) =>
  api.post(
    `/api/password-reset/${encodeURIComponent(uidb64)}/${encodeURIComponent(passwords.token)}/`,
    {
      new_password1: passwords.new_password1,
      new_password2: passwords.new_password2,
    },
  );
export const loginAdmin = (data) => adminApi.post("/api/admin/login/", data);
export const getAdminBooks = (params = {}) => adminApi.get("/api/admin/books/", { params });
export const approveAdminBook = (book_id) => adminApi.post("/api/admin/approve-book/", { book_id });
export const rejectAdminBook = (book_id, rejection_reason) =>
  adminApi.post("/api/admin/reject-book/", { book_id, rejection_reason });
export const deleteAdminBook = (book_id, data = {}) =>
  adminApi.delete("/api/admin/delete-book/", { data: { ...data, book_id } });
export const getAdminUsers = (params = {}) => adminApi.get("/api/admin/users/", { params });
export const updateAdminUser = (id, data) => adminApi.patch(`/api/admin/users/${id}/`, data);
export const deleteAdminUser = (user_id) =>
  adminApi.delete("/api/admin/delete-user/", { data: { user_id } });
export const getAdminOrders = () => adminApi.get("/api/admin/orders/");
export const getAdminReports = () => adminApi.get("/api/admin/reports/");
export const updateAdminReport = (id, data) => adminApi.patch(`/api/admin/reports/${id}/`, data);
export const getMe = () => api.get("/api/users/me/");
export const updateMe = (data) => api.patch("/api/users/me/", data);

export const getBooks = (params = {}) => api.get("/api/books/", { params });
export const getBookById = (id) => api.get(`/api/books/${id}/`);
export const createBook = (data) => api.post("/api/books/", data);
export const updateBook = (id, data) => api.put(`/api/books/${id}/`, data);
export const patchBook = (id, data) => api.patch(`/api/books/${id}/`, data);
export const deleteBook = (id, data) => api.delete(`/api/books/${id}/`, { data });
export const markBookSold = (id) => patchBook(id, { status: "sold" });

export const createOrder = (data) => api.post("/api/orders/", data);
export const getMyOrders = (params = {}) => api.get("/api/orders/my-orders/", { params });
export const getOrders = () => api.get("/api/orders/");
export const updateOrderStatus = (id, order_status) =>
  api.patch(`/api/orders/${id}/`, typeof order_status === "string" ? { order_status } : order_status);
export const getReports = () => api.get("/api/orders/reports/");
export const createReport = (data) => api.post("/api/orders/reports/", data);
export const updateReport = (id, data) => api.patch(`/api/orders/reports/${id}/`, data);
export const getRatings = (params = {}) => api.get("/api/orders/ratings/", { params });
export const createRating = (data) => api.post("/api/orders/ratings/", data);

export const getChats = (params = {}) => api.get("/api/chats/", { params });
export const sendChat = (data) => api.post("/api/chats/", data);

export const getUsers = (params = {}) => api.get("/api/users/", { params });
export const updateUser = (id, data) => api.patch(`/api/users/${id}/`, data);

export default api;
