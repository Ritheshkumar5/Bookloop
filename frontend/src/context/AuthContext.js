import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { loginUser, logoutUser, registerUser } from "../services/api";
import { REFRESH_KEY, TOKEN_KEY, USER_KEY } from "../utils/constants";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      const savedUser = localStorage.getItem(USER_KEY);
      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      }
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem(USER_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await loginUser({ email, password });
    localStorage.setItem(TOKEN_KEY, data.access);
    if (data.refresh) localStorage.setItem(REFRESH_KEY, data.refresh);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setToken(data.access);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback((payload) => registerUser(payload), []);

  const logout = useCallback(async () => {
    const refresh = localStorage.getItem(REFRESH_KEY);
    try {
      if (refresh) await logoutUser(refresh);
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem(USER_KEY);
      setToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({
    user,
    token,
    loading,
    isAuthenticated: Boolean(token && user),
    isAdmin: user?.role === "admin",
    login,
    register,
    logout,
    setUser,
  }), [user, token, loading, login, register, logout]);

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
