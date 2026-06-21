import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { resolveLanding } from "@/lib/auth";

interface Props {
  children: ReactNode;
  /** require any authenticated session */
  requireAuth?: boolean;
  /** require admin role or active membership */
  requireMembership?: boolean;
  /** require at least one active entitlement (or membership/admin) */
  requireEntitlement?: boolean;
}

export function RouteGuard({ children, requireAuth, requireMembership, requireEntitlement }: Props) {
  const { me, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="font-serif text-2xl tracking-wide text-muted-foreground">Alchemy Academy</div>
      </div>
    );
  }

  if (requireAuth && !me) return <Navigate to="/login" state={{ from: location }} replace />;

  if (me) {
    const isAdmin = me.roles.includes("admin");
    const activeMembership = me.membership?.status === "active" || me.membership?.status === "trialing";
    const hasEntitlement = me.activeEntitlements.length > 0;

    if (requireMembership && !isAdmin && !activeMembership) {
      return <Navigate to={hasEntitlement ? "/mycourses" : "/plans"} replace />;
    }
    if (requireEntitlement && !isAdmin && !activeMembership && !hasEntitlement) {
      return <Navigate to="/plans" replace />;
    }
  }

  return <>{children}</>;
}

export function RedirectByRole() {
  const { me, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={resolveLanding(me)} replace />;
}
