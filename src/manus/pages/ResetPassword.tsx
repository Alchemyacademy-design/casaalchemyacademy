import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mail, AlertCircle, CheckCircle2 } from "lucide-react";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSuccess(true);
      setEmail("");

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 bg-card border-border/50">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--aa-olive-dark)" }}>
            Reset Password
          </h1>
          <p className="text-foreground/70">Enter your email to receive a password reset link</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-accent/10 border border-accent/20 rounded-lg flex gap-3">
            <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-accent">Check your email!</p>
              <p className="text-xs text-accent/80 mt-1">
                We've sent a password reset link to your email. Redirecting to login...
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleResetPassword} className="space-y-4 mb-6">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-foreground/50" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={success}
                className="w-full pl-10 pr-4 py-2 border border-border/50 rounded-lg bg-background text-foreground placeholder-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
              />
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading || success}
            className="w-full mt-6"
            style={{ backgroundColor: "var(--aa-gold)" }}
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </Button>
        </form>

        {/* Back to Login */}
        <p className="text-center text-sm text-foreground/70">
          Remember your password?{" "}
          <button
            onClick={() => navigate("/login")}
            className="text-accent hover:text-accent/80 font-medium transition"
          >
            Sign in
          </button>
        </p>
      </Card>
    </div>
  );
}
