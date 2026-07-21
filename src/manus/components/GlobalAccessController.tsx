import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/manus/hooks/useAuth";


const publicPaths = new Set([
  "/",
  "/login",
  "/signup",
  "/reset-password",
  "/auth/callback",
  "/auth/update-password",
  "/privacy-policy",
  "/terms-of-use",
  "/support",
  "/data-deletion",
  "/politica-de-privacidade",
  "/termos-de-uso",
  "/suporte",
  "/exclusao-de-dados",
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
  const { pathname: location } = useLocation();
  const navigate = useNavigate();
  const { loading, isAuthenticated, isAdmin, isMember, hasCourseAccess } = useAuth();

  useEffect(() => {
    // The public certificate verification page is always public — anyone
    // with the link (recruiters, LinkedIn, etc.) must be able to open it
    // without an account.
    if (loading || publicPaths.has(location) || location.startsWith("/c/")) return;

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
