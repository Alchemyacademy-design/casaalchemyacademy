import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/manus/hooks/useAuth";

export default function AdminGuard({ children }: { children: ReactNode }) {
  const { loading, isAuthenticated, isAdmin } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
