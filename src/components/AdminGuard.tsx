import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, ShieldAlert, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/manus/hooks/useAuth";

function FullScreen({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full text-center space-y-4">{children}</div>
    </div>
  );
}

export default function AdminGuard({ children }: { children: ReactNode }) {
  const { authReady, accessReady, session, isAdmin, error, refreshAccess } = useAuth();

  if (!authReady) {
    return (
      <FullScreen>
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-foreground/60" />
        <p className="text-sm text-foreground/60">Loading session…</p>
      </FullScreen>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!accessReady && !error) {
    return (
      <FullScreen>
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-foreground/60" />
        <p className="text-sm text-foreground/70">Checking administrator access…</p>
      </FullScreen>
    );
  }

  if (error) {
    return (
      <FullScreen>
        <ShieldAlert className="w-8 h-8 mx-auto text-destructive" />
        <h1 className="font-serif text-xl">Authorization check failed</h1>
        <p className="text-sm text-foreground/70 break-words">{error}</p>
        <Button onClick={() => void refreshAccess()} variant="default">
          <RefreshCw className="w-4 h-4 mr-2" /> Retry
        </Button>
      </FullScreen>
    );
  }

  if (!isAdmin) {
    return (
      <FullScreen>
        <ShieldAlert className="w-8 h-8 mx-auto text-amber-600" />
        <h1 className="font-serif text-xl">403 — Admin only</h1>
        <p className="text-sm text-foreground/70">
          Your account does not have administrator access.
        </p>
        <Button asChild variant="outline">
          <a href="/dashboard">Back to dashboard</a>
        </Button>
      </FullScreen>
    );
  }

  return <>{children}</>;
}
