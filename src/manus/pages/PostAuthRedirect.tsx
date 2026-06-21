import { useEffect } from "react";
import { useLocation } from "wouter";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/manus/hooks/useAuth";

export default function PostAuthRedirect() {
  const [, navigate] = useLocation();
  const { loading, isAuthenticated, defaultPath } = useAuth();

  useEffect(() => {
    if (loading) return;
    navigate(isAuthenticated ? defaultPath : "/login");
  }, [defaultPath, isAuthenticated, loading, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <Sparkles className="w-8 h-8 text-accent mx-auto mb-4 animate-spin" />
        <p className="text-foreground/70">Preparing your account...</p>
      </div>
    </div>
  );
}
