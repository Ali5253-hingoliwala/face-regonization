import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: "admin" | "student";
}

export default function ProtectedRoute({
  children,
  requiredRole,
}: ProtectedRouteProps) {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && role !== requiredRole) {
    // Logged in, but wrong role -- send them to their own
    // dashboard instead of the one they tried to reach.
    return <Navigate to={role === "admin" ? "/admin" : "/student"} replace />;
  }

  return <>{children}</>;
}
