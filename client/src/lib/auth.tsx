import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { setSessionToken, queryClient } from "./queryClient";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: "admin" | "staff";
  color: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (user: AuthUser, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

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
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
