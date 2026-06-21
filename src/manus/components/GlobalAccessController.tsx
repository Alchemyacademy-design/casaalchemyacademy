import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/manus/hooks/useAuth";

const publicPaths = new Set([
  "/",
  "/login",
  "/signup",
  "/reset-password",
  "/auth/callback",
  "/auth/update-password",
]);

const unpaidAllowedPaths = new Set([
  "/plans",
  "/profile",
  "/payment/success",
  "/payment/cancel",
]);

const membershipOnlyPrefixes = [
  "/dashboard",
  "/community",
  "/suppliers",
  "/events",
  "/magazine",
  "/live-workshops",
];

export default function GlobalAccessController() {
  const [location, navigate] = useLocation();
  const { loading, isAuthenticated, isAdmin, isMember, hasCourseAccess } = useAuth();

  useEffect(() => {
    if (loading || publicPaths.has(location)) return;

    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    if (isAdmin) return;

    const hasAnyPaidAccess = isMember || hasCourseAccess;
    if (!hasAnyPaidAccess && !unpaidAllowedPaths.has(location) && !location.startsWith("/courses")) {
      navigate("/plans");
      return;
    }

    if (!isMember && membershipOnlyPrefixes.some((prefix) => location.startsWith(prefix))) {
      navigate(hasCourseAccess ? "/mycourses" : "/plans");
    }
  }, [hasCourseAccess, isAdmin, isAuthenticated, isMember, loading, location, navigate]);

  return null;
}
