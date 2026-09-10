import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Spinner } from "./ui/Spinner";
import type { UserRole } from "../types";

export function ProtectedRoute({ roles, children }: { roles?: UserRole[]; children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <Spinner label="Loading session..." />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return <>{children}</>;
}
