import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { setSessionToken, getSessionToken, queryClient } from "./queryClient";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: "admin" | "staff";
  color: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (user: AuthUser, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount, try to restore session from localStorage token
  useEffect(() => {
    const token = getSessionToken();
    if (!token) { setLoading(false); return; }
    fetch("/api/auth/me", { headers: { "x-session-token": token } })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setUser(data); else setSessionToken(null); })
      .catch(() => setSessionToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback((user: AuthUser, token: string) => {
    setSessionToken(token);
    setUser(user);
  }, []);

  const logout = useCallback(() => {
    setSessionToken(null);
    setUser(null);
    queryClient.clear();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
