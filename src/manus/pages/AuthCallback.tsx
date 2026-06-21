import { useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    let mounted = true;

    const handleCallback = async () => {
      try {
        const code = new URL(window.location.href).searchParams.get("code");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!mounted) return;
        setLocation(data.session ? "/dashboard" : "/login");
      } catch (error) {
        console.error("Auth callback error:", error);
        if (mounted) setLocation("/login");
      }
    };

    void handleCallback();
    return () => {
      mounted = false;
    };
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4" />
        <p className="text-foreground/70">Completing sign in...</p>
      </div>
    </div>
  );
}

