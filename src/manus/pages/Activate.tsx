import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/manus/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Activate() {
  const [location, navigate] = useLocation();
  const [token, setToken] = useState("");

  useEffect(() => {
    // Extract token from URL query params
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");
    if (tokenParam) {
      setToken(tokenParam);
    }
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (token && token.length === 0) {
      setError("Invalid activation link - no token provided");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Validation
    if (!email || !password || !confirmPassword || !fullName) {
      setError("All fields are required");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      setLoading(false);
      return;
    }

    try {
      // Call the activation mutation
      // Note: This will be implemented once the backend mutation is ready
      console.log("Attempting activation with:", { token, email, fullName });
      
      // For now, simulate the API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setSuccess(true);
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to activate account";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--aa-cream)" }}>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle style={{ color: "var(--aa-olive-dark)" }}>Account Activated! 🎉</CardTitle>
          </CardHeader>
          <CardContent>
            <p style={{ color: "var(--aa-text-mid)" }} className="mb-4">
              Your account has been successfully created. You will be redirected to the login page in a moment.
            </p>
            <p style={{ color: "var(--aa-text-light)" }} className="text-sm">
              If you're not redirected            <a href="/" style={{ color: "var(--aa-gold)", textDecoration: "underline" }}>here</a>.         </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--aa-cream)" }}>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle style={{ color: "var(--aa-olive-dark)" }}>Activate Your Account</CardTitle>
          <p style={{ color: "var(--aa-text-light)", fontSize: "0.875rem" }} className="mt-2">
            Complete your account setup to access Alchemy Academy
          </p>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 rounded" style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--aa-text-dark)" }}>
                Full Name
              </label>
              <Input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                disabled={loading}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--aa-text-dark)" }}>
                Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                disabled={loading}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--aa-text-dark)" }}>
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                disabled={loading}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--aa-text-dark)" }}>
                Confirm Password
              </label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                disabled={loading}
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full"
              style={{
                backgroundColor: "var(--aa-gold)",
                color: "var(--aa-cacao)",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {loading ? "Creating Account..." : "Activate Account"}
            </Button>
          </form>

          <p style={{ color: "var(--aa-text-light)", fontSize: "0.75rem" }} className="mt-4 text-center">
            This activation link will expire in 7 days.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
