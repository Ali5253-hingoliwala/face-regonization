import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { api } from "../api/client";

type Role = "admin" | "student";

interface AuthState {
  token: string | null;
  role: Role | null;
  name: string | null;
  studentId: string | null;
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<Role>;
  signup: (studentId: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    role: null,
    name: null,
    studentId: null,
  });

  // Restore session on page load/refresh.
  useEffect(() => {
    const token = localStorage.getItem("va_token");
    const role = localStorage.getItem("va_role") as Role | null;
    const name = localStorage.getItem("va_name");
    const studentId = localStorage.getItem("va_student_id");

    if (token && role) {
      setState({ token, role, name, studentId });
    }
  }, []);

  async function login(username: string, password: string): Promise<Role> {
    const response = await api.post("/auth/login", { username, password });
    const { access_token, role, name, student_id } = response.data;

    localStorage.setItem("va_token", access_token);
    localStorage.setItem("va_role", role);
    if (name) localStorage.setItem("va_name", name);
    if (student_id) localStorage.setItem("va_student_id", student_id);

    setState({
      token: access_token,
      role,
      name: name ?? null,
      studentId: student_id ?? null,
    });

    return role as Role;
  }

  async function signup(studentId: string, password: string): Promise<void> {
    await api.post("/auth/signup", { student_id: studentId, password });
  }

  function logout() {
    localStorage.removeItem("va_token");
    localStorage.removeItem("va_role");
    localStorage.removeItem("va_name");
    localStorage.removeItem("va_student_id");
    setState({ token: null, role: null, name: null, studentId: null });
  }

  return (
    <AuthContext.Provider
      value={{
        ...state,
        isAuthenticated: !!state.token,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
