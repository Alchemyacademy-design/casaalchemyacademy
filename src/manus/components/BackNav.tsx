import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowUp } from "lucide-react";

interface BackNavProps {
  variant?: "top" | "bottom";
  /** Route to fall back to when history is empty or came from an external referrer. */
  fallback?: string;
  /** Hide entirely on these exact pathnames. */
  hideOn?: string[];
  className?: string;
}

const DEFAULT_HIDE = ["/", "/login", "/signup", "/dashboard", "/admin"];

function resolveFallback(pathname: string, explicit?: string): string {
  if (explicit) return explicit;
  if (pathname.startsWith("/admin")) return "/admin";
  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/mycourses") ||
    pathname.startsWith("/community") ||
    pathname.startsWith("/live-workshops") ||
    pathname.startsWith("/events") ||
    pathname.startsWith("/magazine") ||
    pathname.startsWith("/suppliers") ||
    pathname.startsWith("/deals") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/notifications")
  ) {
    return "/dashboard";
  }
  return "/";
}

export default function BackNav({ variant = "top", fallback, hideOn, className }: BackNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const skip = hideOn ?? DEFAULT_HIDE;
  if (skip.includes(location.pathname)) return null;

  const goBack = () => {
    const target = resolveFallback(location.pathname, fallback);
    const sameOriginRef =
      typeof document !== "undefined" &&
      document.referrer &&
      (() => {
        try {
          return new URL(document.referrer).origin === window.location.origin;
        } catch {
          return false;
        }
      })();
    if (typeof window !== "undefined" && window.history.length > 1 && sameOriginRef) {
      navigate(-1);
    } else {
      navigate(target);
    }
  };

  const scrollTop = () => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (variant === "bottom") {
    return (
      <div className={`aa-backnav aa-backnav--bottom ${className ?? ""}`.trim()}>
        <button type="button" onClick={goBack} className="aa-backnav__btn" aria-label="Go back">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back</span>
        </button>
        <button
          type="button"
          onClick={scrollTop}
          className="aa-backnav__btn aa-backnav__btn--ghost"
          aria-label="Back to top"
        >
          <span>Back to top</span>
          <ArrowUp className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className={`aa-backnav aa-backnav--top ${className ?? ""}`.trim()}>
      <button type="button" onClick={goBack} className="aa-backnav__btn" aria-label="Go back">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        <span>Back</span>
      </button>
    </div>
  );
}